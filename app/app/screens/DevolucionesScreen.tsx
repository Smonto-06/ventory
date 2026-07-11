'use client'

// Devoluciones — réplica 1:1 del prototipo (sDevoluciones / devSalesRows).

import { useState } from 'react'
import { useApp } from '../store'
import { chipStyle, methodTint, methodLabel } from '../ui'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

export default function DevolucionesScreen() {
  const s = useApp()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const rows = !q
    ? s.sales
    : s.sales.filter(
        (v) =>
          v.folio.toLowerCase().includes(q) ||
          (v.customer?.name ?? '').toLowerCase().includes(q) ||
          fmtDate(v.createdAt).toLowerCase().includes(q) ||
          v.items.some((it) => it.product.name.toLowerCase().includes(q)),
      )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header
        style={{
          height: 56,
          flex: 'none',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 clamp(14px,3vw,24px)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <button
          onClick={() => s.go('ventas')}
          className="v-hover-border"
          style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#5A616E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          ← Volver
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16, letterSpacing: '-.2px' }}>Devoluciones</div>
        <div style={{ width: 70 }} />
      </header>

      <div style={{ flex: 1, padding: 'clamp(16px,3vw,28px)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, fecha, artículo o número de factura…"
            style={{
              width: '100%',
              height: 52,
              padding: '0 18px',
              border: '1.5px solid var(--border)',
              borderRadius: 14,
              background: 'var(--surface)',
              fontSize: 15,
              boxShadow: '0 1px 2px rgba(16,20,30,.04)',
            }}
          />

          {rows.length > 0 ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
                overflow: 'hidden',
              }}
            >
              {rows.map((v) => {
                const anulada = v.status === 'CANCELLED'
                const label = methodLabel(v.paymentMethod, v.payments)
                const [mBg, mFg] = methodTint(label)
                const count = v.items.reduce((a, it) => a + it.quantity, 0)
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      s.setSaleDetId(v.id)
                      s.openModal('ventaDetalle')
                    }}
                    className="v-hover-row"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '15px 20px',
                      borderBottom: '1px solid #EEF2F7',
                      flexWrap: 'wrap',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: 'var(--surface)',
                      opacity: anulada ? 0.55 : undefined,
                    }}
                  >
                    <div style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: '#6366F1' }}>{v.folio}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDate(v.createdAt)}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.customer?.name ?? 'Sin cliente'}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                        <span style={chipStyle(mBg, mFg)}>{label}</span>
                        {anulada && <span style={chipStyle('#FDECEC', '#C9433B')}>Anulada</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {count} {count === 1 ? 'art.' : 'arts.'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15.5, fontVariantNumeric: 'tabular-nums', minWidth: 100, textAlign: 'right' }}>
                      {s.fmt(v.total)}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
                padding: '50px 24px',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: 14.5,
              }}
            >
              {`Sin ventas que coincidan con "${query}"`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
