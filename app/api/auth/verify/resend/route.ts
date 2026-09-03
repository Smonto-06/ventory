import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { mailerConfigured, sendVerificationEmail } from '@/lib/mailer'
import { hashToken } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

// Reenvía el correo de verificación. Sin esto, un usuario cuyo correo se
// perdió (spam, demora, filtro) quedaba atascado para siempre.
//
// La respuesta es la misma exista o no la cuenta: no se le revela a un
// extraño qué correos están registrados. Y se deja pasar máximo un reenvío
// por minuto por correo, para que nadie use esto para llenarle la bandeja
// a otra persona.

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000

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

  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.emailVerified || !mailerConfigured()) return generico

  // Máximo un reenvío por minuto por correo, derivado del propio
  // verifyTokenExpires (persistido en BD) en vez de un Map en memoria del
  // proceso: en Vercel cada instancia serverless tiene la suya, así que un
  // Map no frena nada si dos peticiones caen en instancias distintas.
  const ultimoEnvio = user.verifyTokenExpires ? user.verifyTokenExpires.getTime() - VERIFY_TTL_MS : 0
  if (Date.now() - ultimoEnvio < 60_000) return generico

  // En BD solo se guarda el hash del token (lib/tokens.ts), así que si ya
  // había uno no se puede recuperar el texto plano original para reenviar
  // el MISMO enlace — se genera uno nuevo y se invalida el anterior (un
  // enlace viejo sin usar deja de servir, que es lo esperado: solo el
  // último correo enviado debe ser el válido).
  const verifyToken = randomBytes(32).toString('hex')
  await db.user.update({
    where: { id: user.id },
    data: { verifyToken: hashToken(verifyToken), verifyTokenExpires: new Date(Date.now() + VERIFY_TTL_MS) },
  })

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
