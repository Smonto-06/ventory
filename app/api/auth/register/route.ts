import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { mailerConfigured, sendVerificationEmail } from '@/lib/mailer'
import { z } from 'zod'
import { db } from '@/lib/db'
import { TRIAL_DAYS } from '@/lib/plan'

const registerSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
  businessName: z.string().min(2, 'Nombre del negocio debe tener al menos 2 caracteres'),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name)
  let slug = base
  let counter = 1

  while (await db.business.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`
    counter++
  }

  return slug
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, email, password, businessName } = parsed.data
    const normalizedEmail = email.toLowerCase()

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const slug = await generateUniqueSlug(businessName)

    // Verificación de correo: si el mailer no está configurado, la cuenta
    // queda verificada de una (no se bloquea el registro por configuración)
    const needsVerify = mailerConfigured()
    const verifyToken = needsVerify ? randomBytes(32).toString('hex') : null

    // IP de registro (en Vercel llega en x-forwarded-for): el super admin ve
    // cuando varios negocios nacen de la misma conexión — posible prueba
    // gratis repetida. Solo visibilidad, nunca bloqueo automático.
    const signupIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    // Los negocios nuevos entran en prueba gratis; el super-admin los activa tras el pago.
    // La sucursal por defecto es indispensable: sin ella no se puede abrir caja ni vender.
    const business = await db.business.create({
      data: {
        name: businessName,
        slug,
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
        signupIp,
        branches: {
          create: { name: 'Principal' },
        },
        users: {
          create: {
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: 'ADMIN',
            verifyToken,
            emailVerified: needsVerify ? null : new Date(),
          },
        },
      },
      include: { users: true },
    })

    const user = business.users[0]

    if (needsVerify && verifyToken) {
      const base = process.env.NEXTAUTH_URL ?? ''
      try {
        await sendVerificationEmail(user.email, user.name ?? '', `${base}/verify?token=${verifyToken}`)
      } catch (e) {
        // Si el envío falla, no se bloquea el registro: se verifica la cuenta
        console.error('No se pudo enviar verificación:', e)
        await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date(), verifyToken: null } })
      }
    }

    return NextResponse.json(
      {
        message: 'Cuenta creada exitosamente',
        needsVerification: needsVerify,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: business.id,
          businessName: business.name,
          businessSlug: business.slug,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
