import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashToken } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

const ResetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

// Restablece la contraseña con un token vigente (un solo uso)
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = ResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    // Compatibilidad con enlaces ya enviados antes de este cambio (guardaban
    // el token en texto plano): se busca primero por hash y, si no aparece,
    // por el valor crudo — sin este respaldo, cualquier restablecimiento en
    // curso justo al desplegar (hasta 1h de vigencia) fallaría de una con
    // "enlace inválido" aunque el token nunca hubiera expirado.
    const hash = hashToken(parsed.data.token)
    const user = await db.user.findFirst({
      where: { OR: [{ resetToken: hash }, { resetToken: parsed.data.token }] },
    })
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return NextResponse.json(
        { error: 'El enlace ya no es válido. Solicita uno nuevo.' },
        { status: 400 },
      )
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(parsed.data.password, 12),
        resetToken: null,
        resetTokenExpires: null,
        failedAttempts: 0,
        lockedAt: null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/auth/reset]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
