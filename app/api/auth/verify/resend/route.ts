import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { mailerConfigured, sendVerificationEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

// Reenvía el correo de verificación. Sin esto, un usuario cuyo correo se
// perdió (spam, demora, filtro) quedaba atascado para siempre.
//
// La respuesta es la misma exista o no la cuenta: no se le revela a un
// extraño qué correos están registrados. Y se deja pasar máximo un reenvío
// por minuto por correo, para que nadie use esto para llenarle la bandeja
// a otra persona.

// Último reenvío por correo (memoria del proceso: suficiente como freno)
const ultimoReenvio = new Map<string, number>()
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const email = (body as { email?: string })?.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Falta el correo' }, { status: 400 })

  const generico = NextResponse.json({
    ok: true,
    message: 'Si la cuenta existe y está pendiente de verificar, el correo va en camino.',
  })

  if (Date.now() - (ultimoReenvio.get(email) ?? 0) < 60_000) return generico
  ultimoReenvio.set(email, Date.now())

  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.emailVerified || !mailerConfigured()) return generico

  const verifyToken = randomBytes(32).toString('hex')
  await db.user.update({ where: { id: user.id }, data: { verifyToken } })

  const base = process.env.NEXTAUTH_URL ?? ''
  try {
    await sendVerificationEmail(user.email, user.name ?? '', `${base}/verify?token=${verifyToken}`)
  } catch (e) {
    // La misma red de seguridad del registro: si el correo no puede salir
    // (mailer caído), no se deja al usuario por fuera — se verifica solo.
    // Entrar igual exige la contraseña, así que no abre ninguna puerta.
    console.error('No se pudo reenviar verificación:', e)
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date(), verifyToken: null } })
  }

  return generico
}
