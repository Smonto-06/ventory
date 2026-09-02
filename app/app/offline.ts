'use client'

// Modo offline — cola de operaciones pendientes en IndexedDB.
//
// Si al confirmar una venta (de contado o a crédito), una compra o un producto
// nuevo no hay conexión, la operación se guarda localmente y se reintenta
// automáticamente cuando vuelve el internet (o al abrir la app). El inventario
// y los totales se sincronizan al enviarse.
//
// La cola se envía en el mismo orden en que se trabajó (FIFO): si se creó un
// producto sin conexión y luego se vendió, primero llega el producto al
// servidor y con el id real que devuelve se corrigen las ventas y compras
// encoladas que lo mencionaban por su id provisional. Esa corrección se
// escribe en la propia cola, para que sobreviva si la sincronización se corta
// a la mitad.

const DB_NAME = 'ventory-offline'
const STORE = 'operaciones-pendientes'
const LEGACY = 'ventas-pendientes'

export type TipoOperacion = 'venta' | 'compra' | 'producto'

export interface PendingOp {
  id?: number
  tipo: TipoOperacion
  payload: Record<string, unknown>
  /** Texto corto para los avisos ("$12.000", "compra a Distribuidora Sur") */
  resumen: string
  /** Id provisional del producto creado sin conexión (solo tipo 'producto') */
  tempId?: string
  createdAt: string
}

/** Id provisional de un producto creado sin conexión */
export function nuevoTempId(): string {
  return `offline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const esTempId = (id: string) => id.startsWith('offline-')

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      const tx = req.transaction!
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
      // Versión 1 guardaba solo ventas, en su propia bodega: se pasan a la
      // cola nueva para que ninguna venta encolada se pierda al actualizar.
      if (db.objectStoreNames.contains(LEGACY)) {
        const viejas = tx.objectStore(LEGACY)
        const nuevas = tx.objectStore(STORE)
        viejas.getAll().onsuccess = (e) => {
          const rows = (e.target as IDBRequest<Array<{ payload: unknown; total?: number; createdAt?: string }>>).result
          for (const r of rows) {
            nuevas.add({
              tipo: 'venta',
              payload: r.payload,
              resumen: typeof r.total === 'number' ? `$${r.total.toLocaleString('es-CO')}` : 'venta',
              createdAt: r.createdAt ?? new Date().toISOString(),
            })
          }
          viejas.clear()
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueOp(op: Omit<PendingOp, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ ...op, createdAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function pendingOps(): Promise<PendingOp[]> {
  try {
    const db = await openDb()
    const rows = await new Promise<PendingOp[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as PendingOp[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return rows
  } catch {
    return []
  }
}

async function removeOp(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

/** Reemplaza ids provisionales en items[].productId; null si no había ninguno */
function remapPayload(
  payload: Record<string, unknown>,
  mapa: Record<string, string>,
): Record<string, unknown> | null {
  const items = payload.items
  if (!Array.isArray(items)) return null
  let cambio = false
  const nuevos = items.map((it: { productId?: unknown }) => {
    if (typeof it?.productId === 'string' && mapa[it.productId]) {
      cambio = true
      return { ...it, productId: mapa[it.productId] }
    }
    return it
  })
  return cambio ? { ...payload, items: nuevos } : null
}

/** Corrige en disco las operaciones encoladas que mencionan el id provisional */
async function remapEnCola(tempId: string, realId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const row = cursor.value as PendingOp
      const corregido = remapPayload(row.payload, { [tempId]: realId })
      if (corregido) cursor.update({ ...row, payload: corregido })
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

const ENDPOINT: Record<TipoOperacion, string> = {
  venta: '/api/sales',
  compra: '/api/purchases',
  producto: '/api/products',
}

export interface SyncResult {
  /** Operaciones enviadas correctamente, por tipo */
  sent: Record<TipoOperacion, number>
  /** Operaciones que el servidor rechazó de forma definitiva (con su motivo) */
  rejected: Array<{ tipo: TipoOperacion; resumen: string; reason: string }>
  /** Id provisional → id real de los productos creados sin conexión */
  remapped: Record<string, string>
}

const SYNC_LOCK = 'ventory-sync-pendientes'
// Respaldo cuando el navegador no soporta la Web Locks API (Safari viejo):
// sin exclusión real entre pestañas, pero sí evita que dos llamadas
// concurrentes DENTRO de la misma pestaña (p. ej. varios eventos 'online'
// seguidos en una conexión inestable) lean la cola dos veces antes de que la
// primera termine de borrar lo que ya envió.
let syncingLocal = false

/**
 * Envía las operaciones pendientes en orden. Una operación que el servidor
 * rechaza por regla de negocio (stock, plan, caja cerrada) se descarta para
 * no bloquear la cola, pero se reporta para avisarle al usuario. Los errores
 * de red y de servidor se reintentan más tarde.
 *
 * Sin exclusión mutua, dos sincronizaciones concurrentes (dos pestañas del
 * mismo negocio, o varios eventos 'online' seguidos con una conexión
 * inestable) podían leer la cola ANTES de que la primera terminara de borrar
 * lo ya enviado, y reenviar la misma venta/compra/producto dos veces — la
 * Web Locks API serializa esto entre pestañas del mismo origen; cuando la
 * segunda llamada por fin corre, ya no encuentra nada pendiente que repetir.
 */
export async function syncPendingOps(): Promise<SyncResult> {
  const locks = (navigator as unknown as {
    locks?: { request: <T>(name: string, fn: () => Promise<T>) => Promise<T> }
  }).locks
  const vacio: SyncResult = { sent: { venta: 0, compra: 0, producto: 0 }, rejected: [], remapped: {} }
  if (locks) {
    return locks.request(SYNC_LOCK, () => syncPendingOpsInner())
  }
  if (syncingLocal) return vacio
  syncingLocal = true
  try {
    return await syncPendingOpsInner()
  } finally {
    syncingLocal = false
  }
}

async function syncPendingOpsInner(): Promise<SyncResult> {
  const rows = await pendingOps()
  const result: SyncResult = { sent: { venta: 0, compra: 0, producto: 0 }, rejected: [], remapped: {} }
  for (const row of rows) {
    if (row.id === undefined) continue
    const payload = remapPayload(row.payload, result.remapped) ?? row.payload
    try {
      const res = await fetch(ENDPOINT[row.tipo], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        if (row.tipo === 'producto' && row.tempId) {
          const body = (await res.json().catch(() => null)) as { product?: { id?: string } } | null
          if (body?.product?.id) {
            result.remapped[row.tempId] = body.product.id
            await remapEnCola(row.tempId, body.product.id)
          }
        }
        await removeOp(row.id)
        result.sent[row.tipo]++
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408) {
        // Rechazo definitivo (stock, plan, caja cerrada): se descarta, pero se avisa
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        result.rejected.push({ tipo: row.tipo, resumen: row.resumen, reason: body?.error ?? 'Rechazada por el servidor' })
        await removeOp(row.id)
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
