import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, badRequest, serverError } from '@/lib/api-helpers'
import { mailerConfigured, sendContactEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

// Exige sesión (no es un relay abierto), pero sin esto una cuenta válida
// podía mandar mensajes ilimitados al buzón de soporte. Freno simple en
// memoria del proceso — suficiente para este endpoint de bajo volumen.
const MAX_POR_VENTANA = 5
const VENTANA_MS = 10 * 60 * 1000
const envíosPorUsuario = new Map<string, number[]>()
function limiteExcedido(userId: string): boolean {
  const ahora = Date.now()
  const previos = (envíosPorUsuario.get(userId) ?? []).filter((t) => ahora - t < VENTANA_MS)
  if (previos.length >= MAX_POR_VENTANA) {
    envíosPorUsuario.set(userId, previos)
    return true
  }
  previos.push(ahora)
  envíosPorUsuario.set(userId, previos)
  return false
}

const ContactSchema = z.object({
  type: z.enum(['Sugerencia', 'Error', 'Queja o reclamo']),
  subject: z.string().trim().min(1, 'Escribe el asunto').max(200),
  message: z.string().trim().min(1, 'Escribe el mensaje').max(5000),
})

// Envía el mensaje de Contáctanos por correo desde la cuenta del sistema,
// con Reply-To del usuario autenticado que escribe.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  if (limiteExcedido(user.id)) {
    return NextResponse.json({ error: 'Ya enviaste varios mensajes seguidos. Intenta de nuevo más tarde.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  if (!mailerConfigured()) {
    return NextResponse.json(
      { error: 'El envío de correo no está configurado', code: 'MAILER_NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  try {
    const account = await db.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, business: { select: { name: true } } },
    })

    await sendContactEmail({
      type: parsed.data.type,
      subject: parsed.data.subject,
      message: parsed.data.message,
      fromName: account?.name ?? 'Usuario',
      fromEmail: account?.email ?? user.email,
      businessName: account?.business.name ?? user.businessName,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('POST /api/contact', error)
  }
}
