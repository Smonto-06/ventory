'use client'

import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import VentoryLogo from '@/components/VentoryLogo'

interface SidebarProps {
  userName: string
  businessName: string
  role: string
  onClose?: () => void
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

export default function Sidebar({ userName, businessName, role, onClose }: SidebarProps) {
  const pathname = usePathname()

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="w-64 h-full bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-100 flex items-center justify-between">
        <VentoryLogo iconSize={28} />
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar menú"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 px-4 pt-2 pb-0 truncate">{businessName}</p>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
