import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import POSClient from './POSClient'

export default async function POSPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <POSClient
      userId={session.user.id}
      userName={session.user.name ?? session.user.email}
      businessId={session.user.businessId}
      businessName={session.user.businessName}
      branchId={session.user.branchId}
    />
  )
}
