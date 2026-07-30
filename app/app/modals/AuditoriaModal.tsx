'use client'

// Registro de actividad (auditoría) — quién hizo qué y cuándo:
// anulaciones, ajustes de inventario, cambios de producto, cierres, etc.

import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { api } from '../api'
import { Modal, ModalTitle } from '../ui'

interface LogRow {
  id: string
  action: string
  entity: string
  payload: Record<string, unknown> | null
  user: string
  createdAt: string
}

// Acción técnica → texto legible
const ACTION_ES: Record<string, string> = {
  'CREATE:Product': 'Creó un producto',
  'UPDATE:Product': 'Editó un producto',
  'DELETE:Product': 'Archivó un producto',
  'IMPORT:Product': 'Importó productos',
  'CREATE:Sale': 'Registró una venta',
  'VOID:Sale': 'Anuló una venta',
  'RETURN:Sale': 'Registró una devolución',
  'CREATE:Purchase': 'Registró una compra',
  'PAYMENT:Customer': 'Recibió abono de cliente',
  'PAYMENT:Purchase': 'Pagó a proveedor',
  'CLOSE:CashSession': 'Cerró la caja',
  'OPEN:CashSession': 'Abrió la caja',
  'CREATE:CashMovement': 'Registró movimiento de caja',
  'UPDATE:Business': 'Cambió los ajustes del negocio',
  'ADJUSTMENT:Inventory': 'Ajustó el inventario',
  'TRANSFER:Inventory': 'Trasladó inventario',
  'CREATE:User': 'Creó un usuario',
  'UPDATE:User': 'Editó un usuario',
}

function label(l: LogRow): string {
  return ACTION_ES[`${l.action}:${l.entity}`] ?? `${l.action} · ${l.entity}`
}

function detail(l: LogRow): string {
  const p = l.payload
  if (!p) return ''
  const parts: string[] = []
  if (typeof p.folio === 'string') parts.push(p.folio)
  if (typeof p.name === 'string') parts.push(p.name)
  if (typeof p.amount === 'number') parts.push(`$ ${p.amount.toLocaleString('es-CO')}`)
  if (typeof p.created === 'number') parts.push(`${p.created} creados`)
  if (typeof p.difference === 'number') parts.push(`diferencia $ ${p.difference.toLocaleString('es-CO')}`)
  if (Array.isArray(p.fields)) parts.push((p.fields as string[]).join(', '))
  return parts.join(' · ')
}

export default function AuditoriaModal() {
  const s = useApp()
  const [logs, setLogs] = useState<LogRow[] | null>(null)

  useEffect(() => {
    api
      .auditLogs()
      .then((r) => setLogs(r.logs as LogRow[]))
      .catch(() => setLogs([]))
  }, [])

  return (
    <Modal onClose={s.closeModal} maxWidth={520}>
      <ModalTitle onClose={s.closeModal}>Registro de actividad</ModalTitle>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Últimos 200 eventos del negocio: quién hizo qué y cuándo.
      </div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        {logs === null && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>}
        {logs?.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Aún no hay actividad registrada.</div>}
        {logs?.map((l) => (
          <div key={l.id} style={{ padding: '10px 14px', borderBottom: '1px solid #EEF2F7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label(l)}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {new Date(l.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              {l.user}
              {detail(l) ? ` · ${detail(l)}` : ''}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
