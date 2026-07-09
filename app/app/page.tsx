import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import ClientApp from './ClientApp'
import './ventory.css'

export const dynamic = 'force-dynamic'

export default async function VentoryAppPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <ClientApp />
}
