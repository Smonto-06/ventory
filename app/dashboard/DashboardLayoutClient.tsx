'use client'

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

  if (hideSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={userName} businessName={businessName} role={role} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
