import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogoutButton from './LogoutButton'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador',
    SUPERVISOR: 'Supervisor',
    CASHIER: 'Cajero',
    SELLER: 'Vendedor',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ventory</h1>
            <p className="text-sm text-gray-500">{session.user.businessName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{session.user.name || session.user.email}</p>
              <p className="text-xs text-gray-500">{roleLabels[session.user.role] || session.user.role}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Información de sesión</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Usuario</dt>
                <dd className="font-medium text-gray-800">{session.user.name || 'Sin nombre'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-800">{session.user.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Rol</dt>
                <dd className="font-medium text-gray-800">{roleLabels[session.user.role]}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Negocio</dt>
                <dd className="font-medium text-gray-800">{session.user.businessName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">ID del negocio</dt>
                <dd className="font-mono text-xs text-gray-600">{session.user.businessId}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Slug del negocio</dt>
                <dd className="font-mono text-gray-600">{session.user.businessSlug}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <p className="text-amber-800 text-sm font-medium">
              ✓ Multi-tenant activo — todos los datos están aislados por businessId: <code className="font-mono">{session.user.businessId}</code>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
