import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ¿Este correo ya quedó verificado? Lo consulta la pantalla "Revisa tu
// correo" del registro cada pocos segundos, para darse cuenta sola cuando el
// usuario confirma desde el celular u otra pestaña y llevarlo al login.
//
// Un correo inexistente responde igual que uno sin verificar (false): no se
// le revela a un extraño más de lo que el propio registro ya revela.
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const email = (body as { email?: string })?.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Falta el correo' }, { status: 400 })

  const user = await db.user.findUnique({ where: { email }, select: { emailVerified: true } })
  return NextResponse.json({ verified: !!user?.emailVerified })
}
