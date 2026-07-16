import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { mailerConfigured, sendPasswordResetEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const ForgotSchema = z.object({ email: z.string().email() })

// Solicitud de recuperación de contraseña: genera un token de un solo uso (1 hora)
// y envía el enlace por correo. Siempre responde ok para no revelar qué correos existen.
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = ForgotSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribe un correo válido' }, { status: 400 })
  }

  if (!mailerConfigured()) {
    return NextResponse.json(
      { error: 'El envío de correo no está configurado. Escríbenos a ventorypos@gmail.com.' },
      { status: 503 },
    )
  }

  const email = parsed.data.email.toLowerCase()

  try {
    const user = await db.user.findUnique({ where: { email } })
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex')
      await db.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
          resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      })
      const baseUrl = process.env.NEXTAUTH_URL ?? ''
      await sendPasswordResetEmail(email, user.name ?? '', `${baseUrl}/reset?token=${token}`)
    }
    // Misma respuesta exista o no el correo (no filtrar cuentas)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/auth/forgot]', error)
    return NextResponse.json({ error: 'No se pudo enviar el correo. Intenta de nuevo.' }, { status: 500 })
  }
}
