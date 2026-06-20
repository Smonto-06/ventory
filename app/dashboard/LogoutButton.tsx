'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg hover:border-red-200 transition-colors"
    >
      Cerrar sesión
    </button>
  )
}
