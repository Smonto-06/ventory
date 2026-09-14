import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { construirResumen, diaColombiano } from '@/lib/resumen-diario'
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
  // Inicio del día colombiano de "ahora": si Vercel reintenta la invocación
  // del cron (timeout parcial, 5xx, reintento manual), un negocio que ya
  // recibió su resumen HOY no debe recibirlo dos veces.
  const { desde: inicioDeHoy } = diaColombiano(ahora)
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
      lastDailySummaryAt: true,
      users: {
        where: { role: 'ADMIN', isActive: true },
        select: { email: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  let enviados = 0
  let yaEnviados = 0
  const fallos: string[] = []

  for (const n of negocios) {
    if (n.lastDailySummaryAt && n.lastDailySummaryAt >= inicioDeHoy) {
      yaEnviados++
      continue
    }
    const destino = n.notifyEmail?.trim() || n.users[0]?.email
    if (!destino) continue
    try {
      const resumen = await construirResumen(n.id, ahora)
      if (!resumen) continue
      // Si el negocio no quiere el aviso de reposición, el resumen va sin él
      if (!n.notifyLowStock) resumen.agotados = []
      // Un día sin ventas y sin nada por reponer no merece correo
      if (resumen.ventas.transacciones === 0 && resumen.agotados.length === 0) continue

      // Reclama el envío ANTES de mandarlo (condicionado al mismo chequeo de
      // arriba, pero atómico): si dos invocaciones del cron corren
      // solapadas, la lectura de lastDailySummaryAt de ambas puede quedar
      // desactualizada frente a la otra — el updateMany condicionado
      // garantiza que solo una gane la carrera para este negocio.
      const reclamado = await db.business.updateMany({
        where: { id: n.id, OR: [{ lastDailySummaryAt: null }, { lastDailySummaryAt: { lt: inicioDeHoy } }] },
        data: { lastDailySummaryAt: ahora },
      })
      if (reclamado.count === 0) {
        yaEnviados++
        continue
      }

      try {
        await sendDailySummaryEmail(destino, resumen)
        enviados++
      } catch (error) {
        // El envío falló DESPUÉS de reclamarlo: se libera el reclamo para
        // que un reintento real (invocación posterior del mismo día) pueda
        // volver a intentarlo, en vez de darlo por enviado para siempre hoy.
        await db.business.update({ where: { id: n.id }, data: { lastDailySummaryAt: n.lastDailySummaryAt } })
        throw error
      }
    } catch (error) {
      console.error(`resumen diario · negocio ${n.id}:`, error)
      fallos.push(n.id)
    }
  }

  return NextResponse.json({ negocios: negocios.length, enviados, yaEnviados, fallos: fallos.length })
}
