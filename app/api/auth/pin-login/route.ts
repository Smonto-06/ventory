import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { encode } from 'next-auth/jwt'

const pinLoginSchema = z.object({
  businessSlug: z.string().min(1, 'Negocio requerido'),
  pin: z.string().length(4, 'PIN debe ser de 4 dígitos').regex(/^\d+$/, 'PIN solo debe contener números'),
})

const LOCK_DURATION_MS = 15 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 5

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = pinLoginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { businessSlug, pin } = parsed.data

    const business = await db.business.findUnique({
      where: { slug: businessSlug },
    })

    if (!business) {
      return NextResponse.json(
        { error: 'Negocio no encontrado' },
        { status: 404 }
      )
    }

    // Find active users with PIN in this business — un usuario desactivado
    // (Ajustes → Usuarios) tampoco puede entrar por PIN
    const users = await db.user.findMany({
      where: {
        businessId: business.id,
        pin: { not: null },
        isActive: true,
      },
    })

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No hay cajeros con PIN configurado en este negocio' },
        { status: 404 }
      )
    }

    // Check each user's PIN (compare hashed)
    let matchedUser = null
    for (const user of users) {
      if (!user.pin) continue

      // Check lock status
      if (user.lockedAt) {
        const lockExpires = new Date(user.lockedAt.getTime() + LOCK_DURATION_MS)
        if (new Date() < lockExpires) continue // Skip locked accounts
        else {
          await db.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedAt: null },
          })
        }
      }

      const pinMatch = await bcrypt.compare(pin, user.pin)
      if (pinMatch) {
        matchedUser = user
        break
      }
    }

    if (!matchedUser) {
      // El PIN se compara contra TODOS los usuarios del negocio a la vez (no
      // se elige antes a quién pertenece), así que no hay forma de saber a
      // cuál cuenta atribuirle este intento fallido. Bloquear a todos por un
      // solo PIN equivocado dejaría a todo el equipo sin acceso rápido con
      // solo 5 intentos — un bloqueo trivial de cualquiera, no solo de quien
      // se equivocó. Bloquear SÍ tiene sentido cuando hay un único cajero con
      // PIN en el negocio: ahí el intento es inequívocamente suyo.
      if (users.length === 1) {
        const [u] = users
        // {increment: 1}, no leer-y-sumar en memoria: mismo arreglo que en
        // el login normal (lib/auth.ts) — una ráfaga de intentos paralelos
        // podía pisarse entre sí y nunca activar el bloqueo.
        const actualizado = await db.user.update({
          where: { id: u.id },
          data: { failedAttempts: { increment: 1 } },
          select: { failedAttempts: true },
        })
        if (actualizado.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          await db.user.update({ where: { id: u.id }, data: { lockedAt: new Date() } })
        }
      }

      return NextResponse.json(
        { error: 'PIN incorrecto' },
        { status: 401 }
      )
    }

    // Reset failed attempts
    await db.user.update({
      where: { id: matchedUser.id },
      data: { failedAttempts: 0, lockedAt: null },
    })

    // Issue a JWT token for the PIN session
    const token = await encode({
      token: {
        id: matchedUser.id,
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        businessId: matchedUser.businessId,
        businessName: business.name,
        businessSlug: business.slug,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 8 * 60 * 60, // 8 hours
    })

    const response = NextResponse.json({
      message: 'Login exitoso',
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
        businessId: matchedUser.businessId,
        businessName: business.name,
        businessSlug: business.slug,
      },
    })

    // El nombre de la cookie tiene que calcularse EXACTAMENTE como lo hace
    // NextAuth (next-auth/jwt: secureCookie = NEXTAUTH_URL empieza por
    // https, o si no, si corre en Vercel) — si no coincide, el middleware y
    // getServerSession/getCurrentUser (que sí usan el cálculo real de
    // NextAuth) no encuentran esta cookie y el login por PIN queda roto en
    // producción (HTTPS) aunque funcione perfecto en local (HTTP), donde
    // los dos nombres coinciden por casualidad.
    const secureCookie = process.env.NEXTAUTH_URL?.startsWith('https://') ?? !!process.env.VERCEL
    const cookieName = secureCookie ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('PIN login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
