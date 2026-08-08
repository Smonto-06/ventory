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

    try {
      await sendDailySummaryEmail(destino, resumen)
    } catch (e) {
      // Este botón es EL diagnóstico del correo: si el proveedor rechaza el
      // envío, el administrador necesita saber por qué, no un error genérico.
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Prueba de correo falló:', e)
      let pista = 'Revisa las variables de correo en Vercel y redespliega.'
      if (/535|auth|credentials/i.test(msg)) {
        pista =
          'El servidor rechazó el usuario o la clave. Revisa SMTP_USER (el login SMTP, tipo 8abc123@smtp-brevo.com) y SMTP_PASS (la CLAVE SMTP de Brevo, empieza por xsmtpsib- — no la llave de API xkeysib-).'
      } else if (/sender|from address|not.*(allowed|valid|verified)/i.test(msg)) {
        pista =
          'El remitente no está autorizado. MAIL_FROM debe ser un remitente verificado en tu proveedor (Brevo → Remitentes).'
      } else if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|greeting|connect/i.test(msg)) {
        pista = 'No hubo conexión con el servidor de correo. Revisa SMTP_HOST y SMTP_PORT (Brevo: smtp-relay.brevo.com, 587).'
      }
      return NextResponse.json({ error: `No se pudo enviar. ${pista}`, detalle: msg }, { status: 502 })
    }
    return NextResponse.json({ enviado: true, destino })
  } catch (error) {
    return serverError('POST /api/notifications/test', error)
  }
}
