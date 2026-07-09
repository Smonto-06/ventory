'use client'

// Historial de Ventas — réplica 1:1 del prototipo (sVentas / histTabs / histRows).

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Sale } from '../api'
import { chipStyle, methodTint, methodLabel } from '../ui'

type HistTab = 'hoy' | 'semana' | 'rango'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

const dateInputStyle: CSSProperties = {
  height: 38,
  padding: '0 12px',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface)',
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--text)',
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
  overflow: 'hidden',
}

const tabBase: CSSProperties = {
  padding: '9px 16px',
  borderRadius: 9,
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all .12s',
  whiteSpace: 'nowrap',
}

export default function VentasScreen() {
  const s = useApp()
  const [tab, setTab] = useState<HistTab>('hoy')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const st0 = new Date()
  st0.setHours(0, 0, 0, 0)
  let rows: Sale[] = s.sales
  if (tab === 'hoy') {
    rows = s.sales.filter((v) => new Date(v.createdAt).getTime() >= st0.getTime())
  } else if (tab === 'semana') {
    rows = s.sales.filter((v) => new Date(v.createdAt).getTime() >= st0.getTime() - 6 * 86400000)
  } else {
    const f0 = from ? new Date(from + 'T00:00:00').getTime() : 0
    const t0 = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    rows = s.sales.filter((v) => {
      const ts = new Date(v.createdAt).getTime()
      return ts >= f0 && ts <= t0
    })
  }

  const histTotal = rows.filter((v) => v.status !== 'CANCELLED').reduce((a, v) => a + v.total, 0)

  const tabs: Array<[HistTab, string]> = [
    ['hoy', 'Hoy'],
    ['semana', 'Esta semana'],
    ['rango', 'Rango'],
  ]

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Ventas</h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.4px' }}>{s.fmt(histTotal)}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {rows.length} {rows.length === 1 ? 'venta' : 'ventas'} en el período
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
            padding: 4,
            alignSelf: 'flex-start',
          }}
        >
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                ...tabBase,
                ...(tab === k
                  ? { background: '#6366F1', color: '#fff' }
                  : { color: 'var(--muted)', background: 'transparent' }),
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => s.go('devoluciones')}
          className="v-hover-underline"
          style={{ color: '#6366F1', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
        >
          Devoluciones →
        </button>
      </div>

      {tab === 'rango' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInputStyle} />
          <span style={{ color: 'var(--muted)', fontWeight: 700 }}>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInputStyle} />
        </div>
      )}

      {rows.length > 0 ? (
        <div style={cardStyle}>
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
                <div style={{ minWidth: 110 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#6366F1' }}>{v.folio}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{fmtDate(v.createdAt)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={chipStyle(mBg, mFg)}>{label}</span>
                  {anulada && <span style={chipStyle('#FDECEC', '#C9433B')}>Anulada</span>}
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
        <div style={{ ...cardStyle, padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
          Sin ventas en el período seleccionado.
          <br />
          <span style={{ fontSize: 13.5 }}>Las ventas que registres en el punto de venta aparecerán aquí.</span>
        </div>
      )}
    </div>
  )
}
