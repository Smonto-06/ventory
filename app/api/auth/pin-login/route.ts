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

    // Find users with PIN in this business
    const users = await db.user.findMany({
      where: {
        businessId: business.id,
        pin: { not: null },
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
      // Increment failed attempts for all PIN users in this business
      await db.user.updateMany({
        where: { businessId: business.id, pin: { not: null } },
        data: { failedAttempts: { increment: 1 } },
      })

      // Check if any should be locked
      const updatedUsers = await db.user.findMany({
        where: { businessId: business.id, pin: { not: null } },
      })

      for (const u of updatedUsers) {
        if (u.failedAttempts >= MAX_FAILED_ATTEMPTS && !u.lockedAt) {
          await db.user.update({
            where: { id: u.id },
            data: { lockedAt: new Date() },
          })
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

    // Set the session cookie
    response.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
