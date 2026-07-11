'use client'

// Modal de devolución por artículo — réplica 1:1 del prototipo (mDevolucion / devRows).

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, saveBtnStyle } from '../ui'

export default function DevolucionModal() {
  const s = useApp()
  const [qty, setQty] = useState<Record<string, number>>({})
  const sale = s.sales.find((v) => v.id === s.saleDetId)
  if (!sale) return null

  const rows = sale.items.map((it) => {
    const avail = it.quantity - it.returnedQty
    const q = Math.min(qty[it.id] ?? 0, avail)
    const unit = Math.round(it.total / it.quantity)
    return { it, avail, q, refund: unit * q }
  })
  const devTotal = rows.reduce((a, r) => a + r.refund, 0)
  const ok = devTotal > 0
  const items = rows.filter((r) => r.q > 0).map((r) => ({ saleItemId: r.it.id, quantity: r.q }))

  const dec = (id: string) => setQty((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) - 1) }))
  const inc = (id: string, avail: number) => setQty((p) => ({ ...p, [id]: Math.min(avail, (p[id] ?? 0) + 1) }))

  return (
    <Modal onClose={s.closeModal} maxWidth={440}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Devolución · {sale.folio}</h2>
        <button
          onClick={s.closeModal}
          className="v-hover-denom"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'var(--bg)',
            color: '#5A616E',
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>Elige cuántas unidades de cada artículo se devuelven:</div>

      <div style={{ marginTop: 10 }}>
        {rows.map(({ it, avail, q, refund }) => (
          <div
            key={it.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid #EEF2F7', flexWrap: 'wrap' }}
          >
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{it.product.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Disponibles: {avail}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
              <button
                onClick={() => dec(it.id)}
                className="v-hover-denom"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                −
              </button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{q}</span>
              <button
                onClick={() => inc(it.id, avail)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: '#FDF4E5',
                  color: '#B4740A',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
            <span
              style={{
                minWidth: 80,
                textAlign: 'right',
                fontWeight: 700,
                fontSize: 13.5,
                color: '#C9433B',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {refund > 0 ? s.fmt(refund) : ''}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800 }}>Total a reembolsar</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#C9433B', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(devTotal)}</span>
      </div>

      <div style={{ marginTop: 10, fontSize: 12.5, color: '#8A6B2E', background: '#FDF4E5', borderRadius: 9, padding: '9px 12px' }}>
        El stock se regresa al inventario y el reembolso se registra como gasto de caja.
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          onClick={s.closeModal}
          className="v-hover-denom"
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: 14.5,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (ok) s.doReturn(sale.id, items, false)
          }}
          disabled={!ok}
          style={saveBtnStyle(ok)}
        >
          Confirmar devolución
        </button>
      </div>

      <button
        onClick={() => {
          if (ok) s.doReturn(sale.id, items, true)
        }}
        disabled={!ok}
        style={{
          width: '100%',
          height: 48,
          marginTop: 8,
          borderRadius: 12,
          fontWeight: 800,
          fontSize: 14.5,
          color: '#fff',
          cursor: ok ? 'pointer' : 'not-allowed',
          background: ok ? '#D9820E' : '#C7CDEC',
          boxShadow: ok ? '0 8px 18px -8px #D9820Ecc' : undefined,
        }}
      >
        Hacer cambio (aplicar como descuento)
      </button>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        El valor devuelto se aplica como crédito (descuento) en una nueva venta en el punto de venta.
      </div>
    </Modal>
  )
}
