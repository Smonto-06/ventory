import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { construirResumen } from '@/lib/resumen-diario'
import { mailerConfigured, sendDailySummaryEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Resumen diario por correo.
//
// Lo dispara el cron de Vercel una vez al día (ver vercel.json). Vercel manda
// la cabecera "Authorization: Bearer $CRON_SECRET"; sin ese secreto la ruta no
// responde, porque si no cualquiera podría pedir el envío de los resúmenes de
// todos los negocios.
//
// Solo se envía a negocios que lo activaron en Ajustes y cuyo plan está al día:
// a un negocio suspendido no tiene sentido escribirle todos los días.

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  return req.headers.get('authorization') === `Bearer ${secreto}`
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!mailerConfigured()) {
    return NextResponse.json({ error: 'El correo no está configurado en el servidor' }, { status: 503 })
  }

  const ahora = new Date()
  const negocios = await db.business.findMany({
    where: {
      notifyDailySummary: true,
      isActive: true,
      status: { in: ['ACTIVE', 'TRIAL'] },
    },
    select: {
      id: true,
      notifyEmail: true,
      notifyLowStock: true,
      users: {
        where: { role: 'ADMIN', isActive: true },
        select: { email: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  let enviados = 0
  const fallos: string[] = []

  for (const n of negocios) {
    const destino = n.notifyEmail?.trim() || n.users[0]?.email
    if (!destino) continue
    try {
      const resumen = await construirResumen(n.id, ahora)
      if (!resumen) continue
      // Si el negocio no quiere el aviso de reposición, el resumen va sin él
      if (!n.notifyLowStock) resumen.agotados = []
      // Un día sin ventas y sin nada por reponer no merece correo
      if (resumen.ventas.transacciones === 0 && resumen.agotados.length === 0) continue
      await sendDailySummaryEmail(destino, resumen)
      enviados++
    } catch (error) {
      console.error(`resumen diario · negocio ${n.id}:`, error)
      fallos.push(n.id)
    }
  }

  return NextResponse.json({ negocios: negocios.length, enviados, fallos: fallos.length })
}
