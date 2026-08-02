import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, serverError, isAdmin } from '@/lib/api-helpers'
import { construirResumen } from '@/lib/resumen-diario'

export const dynamic = 'force-dynamic'

// Devuelve el resumen del día tal como saldría por correo, sin enviarlo.
// Sirve para revisar las cifras antes de activar el envío y para probar la
// lógica del resumen sin depender del servidor de correo.

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return unauthorized()
    if (!isAdmin(user)) return forbidden()

    const resumen = await construirResumen(user.businessId, new Date())
    if (!resumen) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    return NextResponse.json({ resumen })
  } catch (error) {
    return serverError('GET /api/notifications/preview', error)
  }
}
