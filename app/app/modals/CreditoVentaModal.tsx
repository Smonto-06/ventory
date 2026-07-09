'use client'

// Modal Pago a crédito (venta) — réplica del bloque mCreditoVenta del prototipo
// (docs/prototype/Ventory POS.dc.html). Elegir un cliente ejecuta
// s.finalizeCredito(id) con el carrito actual y el store navega al recibo.

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle } from '../ui'

export default function CreditoVentaModal() {
  const s = useApp()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const rows = s.customers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.document ?? '').includes(q),
  )

  return (
    <Modal onClose={s.closeModal} maxWidth={440}>
      <ModalTitle onClose={s.closeModal}>Pago a crédito</ModalTitle>

      <div style={{ background: '#FDF4E5', borderRadius: 12, padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, color: '#8A6B2E', fontWeight: 600 }}>Total de la venta</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#B4740A', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.total)}</span>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
        Elige el cliente a cuya cuenta se agregará el valor:
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, teléfono, documento…"
        autoFocus
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 11,
          background: 'var(--input)',
          fontSize: 14,
          marginTop: 10,
        }}
      />

      <div style={{ marginTop: 10, border: '1px solid #EEF2F7', borderRadius: 12, overflowY: 'auto', maxHeight: 260 }}>
        {rows.length > 0 ? (
          rows.map((c) => (
            <button
              key={c.id}
              onClick={() => s.finalizeCredito(c.id)}
              className="v-hover-bg"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderBottom: '1px solid var(--bg)',
                cursor: 'pointer',
                textAlign: 'left',
                background: 'var(--surface)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#EEF0FE',
                  color: '#4338CA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                  flex: 'none',
                }}
              >
                {c.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{c.phone ?? '—'}</div>
              </div>
              <span style={{ fontSize: 12, color: '#B4740A', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {c.balance > 0 ? `Saldo: ${s.fmt(c.balance)}` : 'Sin saldo'}
              </span>
            </button>
          ))
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
            Sin resultados. Crea el cliente en la sección Clientes.
          </div>
        )}
      </div>
    </Modal>
  )
}
