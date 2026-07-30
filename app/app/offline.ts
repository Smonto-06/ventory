'use client'

// Modo offline — cola de ventas pendientes en IndexedDB.
//
// Si al finalizar una venta no hay conexión, la venta se guarda localmente y
// se reintenta automáticamente cuando vuelve el internet (o al abrir la app).
// El inventario y los totales se sincronizan al enviarse.

const DB_NAME = 'ventory-offline'
const STORE = 'ventas-pendientes'

export interface PendingSale {
  id?: number
  payload: unknown
  total: number
  createdAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueSale(payload: unknown, total: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ payload, total, createdAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function pendingSales(): Promise<PendingSale[]> {
  try {
    const db = await openDb()
    const rows = await new Promise<PendingSale[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as PendingSale[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return rows
  } catch {
    return []
  }
}

async function removeSale(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

export interface SyncResult {
  /** Ventas enviadas correctamente */
  sent: number
  /** Ventas que el servidor rechazó de forma definitiva (con su motivo) */
  rejected: Array<{ total: number; reason: string }>
}

/**
 * Envía las ventas pendientes. Una venta que el servidor rechaza por regla de
 * negocio (stock, plan, caja cerrada) se descarta para no bloquear la cola,
 * pero se reporta para avisarle al cajero. Los errores de red se reintentan.
 */
export async function syncPendingSales(): Promise<SyncResult> {
  const rows = await pendingSales()
  const result: SyncResult = { sent: 0, rejected: [] }
  for (const row of rows) {
    if (row.id === undefined) continue
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row.payload),
      })
      if (res.ok) {
        await removeSale(row.id)
        result.sent++
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408) {
        // Rechazo definitivo (stock, plan, caja cerrada): se descarta, pero se avisa
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        result.rejected.push({ total: row.total, reason: body?.error ?? 'Rechazada por el servidor' })
        await removeSale(row.id)
      } else {
        break // error de servidor: reintentar más tarde
      }
    } catch {
      break // sigue sin conexión
    }
  }
  return result
}

/** Registra el service worker (una vez, en producción y en local) */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}
