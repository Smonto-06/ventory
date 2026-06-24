import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const setPinSchema = z.object({
  userId: z.string().optional(),
  pin: z.string().length(4, 'PIN debe ser de 4 dígitos').regex(/^\d+$/, 'PIN solo debe contener números'),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only admins can set PINs for other users; cashiers set their own
    const body = await request.json()
    const parsed = setPinSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { userId, pin } = parsed.data
    const targetUserId = userId || session.user.id

    // Non-admins can only set their own PIN
    if (targetUserId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Ensure target user belongs to the same business (multi-tenant isolation)
    const targetUser = await db.user.findFirst({
      where: { id: targetUserId, businessId: session.user.businessId },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const hashedPin = await bcrypt.hash(pin, 12)

    await db.user.update({
      where: { id: targetUserId },
      data: { pin: hashedPin },
    })

    return NextResponse.json({ message: 'PIN configurado exitosamente' })
  } catch (error) {
    console.error('Set PIN error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
