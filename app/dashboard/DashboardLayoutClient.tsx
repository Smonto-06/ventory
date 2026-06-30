'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

interface Props {
  children: React.ReactNode
  userName: string
  businessName: string
  role: string
}

const NO_SIDEBAR_PATHS = ['/dashboard/pos']

export default function DashboardLayoutClient({ children, userName, businessName, role }: Props) {
  const pathname = usePathname()
  const hideSidebar = NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p))
  const [mobileOpen, setMobileOpen] = useState(false)

  if (hideSidebar) return <>{children}</>

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          userName={userName}
          businessName={businessName}
          role={role}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Abrir menú"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="font-bold text-gray-800 text-sm">Ventory</span>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
