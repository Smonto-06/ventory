import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'

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

    const business = await db.business.create({
      data: {
        name: businessName,
        slug,
        users: {
          create: {
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: 'ADMIN',
          },
        },
      },
      include: { users: true },
    })

    const user = business.users[0]

    return NextResponse.json(
      {
        message: 'Cuenta creada exitosamente',
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
