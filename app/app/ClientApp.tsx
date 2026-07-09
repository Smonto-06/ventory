'use client'

import { AppProvider } from './store'
import Shell from './Shell'

export default function ClientApp() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
