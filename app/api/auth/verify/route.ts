import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashToken } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

// Verificación de correo: consume el token del enlace enviado al registrarse
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const token = (body as { token?: string })?.token
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { verifyToken: hashToken(token) } })
  if (!user) {
    return NextResponse.json(
      { error: 'El enlace no es válido o ya fue usado. Si ya verificaste, inicia sesión.' },
      { status: 400 },
    )
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), verifyToken: null },
  })

  return NextResponse.json({ verified: true, email: user.email })
}
