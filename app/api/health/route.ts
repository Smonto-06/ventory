import { NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    // Diagnóstico de migraciones: ¿la base de datos tiene lo último que el
    // código espera? (la tabla de pagos llegó con la pasarela). Público y
    // sin datos: solo dice si el esquema está al día, para no tener que
    // escarbar logs de Vercel cuando algo no cuadre tras un despliegue.
    let migraciones = 'al día'
    try {
      await prisma.$queryRaw`SELECT 1 FROM plan_payments LIMIT 1`
    } catch {
      migraciones = 'PENDIENTES — la base de datos no tiene los cambios del último despliegue'
    }
    return NextResponse.json({
      status: 'ok',
      migraciones,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'unreachable' },
      { status: 503 },
    )
  }
}
