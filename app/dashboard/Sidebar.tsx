'use client'

import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface SidebarProps {
  userName: string
  businessName: string
  role: string
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Panel Principal', icon: '🏠', exact: true },
  { href: '/dashboard/pos', label: 'Punto de Venta', icon: '🛒', exact: false },
  { href: '/dashboard/products', label: 'Productos', icon: '📦', exact: false },
  { href: '/dashboard/sales', label: 'Ventas', icon: '📋', exact: false },
  { href: '/dashboard/reports', label: 'Reportes', icon: '📊', exact: false },
]

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CASHIER: 'Cajero',
  SELLER: 'Vendedor',
}

export default function Sidebar({ userName, businessName, role }: SidebarProps) {
  const pathname = usePathname()

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="text-lg font-bold text-blue-600 leading-none">Ventory</p>
        <p className="text-xs text-gray-500 mt-1 truncate">{businessName}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
        <p className="text-xs text-gray-500 mt-0.5">{ROLE_LABELS[role] ?? role}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-3 w-full text-xs text-gray-500 hover:text-red-600 text-left transition-colors"
        >
          Cerrar sesión →
        </button>
      </div>
    </aside>
  )
}
