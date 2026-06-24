import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Find the most recent open cash session for this business
    // Prefer the one from the user's branch if set
    const whereBase = {
      status: 'OPEN' as const,
      branch: { businessId: session.user.businessId },
    }

    const cashSession = await db.cashSession.findFirst({
      where: session.user.branchId
        ? { ...whereBase, branchId: session.user.branchId }
        : whereBase,
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { openedAt: 'desc' },
    })

    if (!cashSession) {
      return NextResponse.json({ cashSession: null })
    }

    return NextResponse.json({
      cashSession: {
        id: cashSession.id,
        status: cashSession.status,
        openingBalance: Number(cashSession.openingBalance),
        openedAt: cashSession.openedAt,
        branch: cashSession.branch,
        openedBy: cashSession.openedBy,
      },
    })
  } catch (error) {
    console.error('Cash session active error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
