import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { requireActiveBusiness } from '@/lib/plan'

/** Otra apertura concurrente del mismo usuario ya ganó la carrera */
class AlreadyOpenError extends Error {
  constructor(public sessionId: string) {
    super('Ya tienes una caja abierta en este turno')
    this.name = 'AlreadyOpenError'
  }
}

const openSchema = z.object({
  branchId: z.string().min(1, 'Sucursal requerida'),
  terminal: z.string().optional(),
  openingBalance: z.number().min(0, 'El monto inicial no puede ser negativo'),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const parsed = openSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { branchId, terminal, openingBalance, notes } = parsed.data

  // Prueba vencida o plan suspendido → no se puede abrir caja
  const planBlock = await requireActiveBusiness(user.businessId)
  if (planBlock) return planBlock

  const branch = await db.branch.findFirst({
    where: { id: branchId, businessId: user.businessId, isActive: true },
  })
  if (!branch) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  try {
    const session = await db.$transaction(async (tx) => {
      // Lock consultivo de Postgres, propio de esta transacción, con clave
      // derivada del usuario: serializa dos aperturas casi simultáneas del
      // MISMO usuario (doble clic) sin necesitar un índice único nuevo en
      // el schema — la segunda espera a que la primera termine (commit o
      // rollback) antes de hacer su propio chequeo, así que ya no puede
      // colarse viendo "sin caja abierta" con datos obsoletos.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`

      const existing = await tx.cashSession.findFirst({
        where: { openedById: user.id, status: 'OPEN' },
        select: { id: true },
      })
      if (existing) {
        throw new AlreadyOpenError(existing.id)
      }

      return tx.cashSession.create({
        data: {
          branchId,
          openedById: user.id,
          terminal,
          openingBalance,
          notes,
          status: 'OPEN',
        },
        include: {
          branch: { select: { id: true, name: true } },
          openedBy: { select: { id: true, name: true, role: true } },
        },
      })
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    if (error instanceof AlreadyOpenError) {
      return NextResponse.json(
        { error: error.message, sessionId: error.sessionId },
        { status: 409 },
      )
    }
    throw error
  }
}
