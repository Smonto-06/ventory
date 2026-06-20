import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayoutClient from './DashboardLayoutClient'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <DashboardLayoutClient
      userName={session.user.name ?? session.user.email ?? 'Usuario'}
      businessName={session.user.businessName}
      role={session.user.role}
    >
      {children}
    </DashboardLayoutClient>
  )
}
