import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/plan'
import AdminClient from './AdminClient'
import '../app/ventory.css'

export const dynamic = 'force-dynamic'

// Panel del super-admin: solo accesible para SUPER_ADMIN_EMAIL
export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (!isSuperAdmin(session.user.email)) redirect('/app')
  return <AdminClient />
}
