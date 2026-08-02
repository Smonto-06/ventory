import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, serverError, isAdmin } from '@/lib/api-helpers'
import { construirResumen } from '@/lib/resumen-diario'
import { mailerConfigured, sendDailySummaryEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

// Envío de prueba del resumen diario.
//
// Sin esto habría que esperar al día siguiente para saber si el correo llega y
// si se ve bien. Manda el resumen de HOY al destino configurado.

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return unauthorized()
    if (!isAdmin(user)) return forbidden()

    if (!mailerConfigured()) {
      return NextResponse.json(
        { error: 'El envío de correos no está configurado. Escríbenos y lo activamos.' },
        { status: 503 },
      )
    }

    const negocio = await db.business.findUnique({
      where: { id: user.businessId },
      select: {
        notifyEmail: true,
        users: {
          where: { role: 'ADMIN', isActive: true },
          select: { email: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    })
    const destino = negocio?.notifyEmail?.trim() || negocio?.users[0]?.email
    if (!destino) {
      return NextResponse.json({ error: 'No hay un correo de destino configurado' }, { status: 400 })
    }

    const resumen = await construirResumen(user.businessId, new Date())
    if (!resumen) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    await sendDailySummaryEmail(destino, resumen)
    return NextResponse.json({ enviado: true, destino })
  } catch (error) {
    return serverError('POST /api/notifications/test', error)
  }
}
