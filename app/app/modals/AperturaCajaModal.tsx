'use client'

// Apertura de caja al iniciar sesión — réplica 1:1 del prototipo (mAperturaCaja),
// con sugerencia del último cierre y calculadora de conteo.

import { useState } from 'react'
import { useApp } from '../store'
import { BILLS, COINS } from '../ui'

export default function AperturaCajaModal() {
  const s = useApp()
  const [amount, setAmount] = useState<number>(() => {
    const lastShift = s.shifts[0]
    return lastShift ? lastShift.countedBalance : Number(s.settings?.defaultOpeningAmount ?? 0)
  })
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [calcOpen, setCalcOpen] = useState(false)

  const lastShift = s.shifts[0]
  const counted = Object.entries(counts).reduce((a, [v, c]) => a + Number(v) * (c || 0), 0)

  const setCount = (denom: number, raw: string) => {
    const c = parseInt((raw || '').replace(/\D/g, '')) || 0
    const next = { ...counts, [denom]: c }
    setCounts(next)
    setAmount(Object.entries(next).reduce((a, [v, n]) => a + Number(v) * (n || 0), 0))
  }

  const countRow = (v: number) => (
    <div key={v} style={{ display: 'grid', gridTemplateColumns: '1fr 78px 1fr', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(v)}</span>
      <input
        value={counts[v] || ''}
        onChange={(e) => setCount(v, e.target.value)}
        inputMode="numeric"
        placeholder="0"
        style={{ height: 36, border: '1.5px solid var(--border)', borderRadius: 9, background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}
      />
      <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        {counts[v] ? s.fmt(counts[v] * v) : ''}
      </span>
    </div>
  )

  return (
    <div
      data-no-print="true"
      onClick={s.closeModal}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.55)', zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 18, padding: 24, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEF0FE', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="4" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Abrir caja</h2>
            <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Declara con cuánto efectivo abre el turno</div>
          </div>
        </div>

        {lastShift && (
          <div style={{ marginTop: 16, background: '#EEF0FE', border: '1px solid #DDE1FB', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '.4px' }}>Dinero del último cierre</div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Lo que debería haber en la caja ahora</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#4F46E5', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {s.fmt(lastShift.countedBalance)}
            </div>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '14px 0 6px' }}>
          Base de caja inicial (efectivo contado)
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={amount || ''}
            onChange={(e) => setAmount(parseInt((e.target.value || '').replace(/\D/g, '')) || 0)}
            inputMode="numeric"
            placeholder="0"
            style={{ flex: 1, height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 18, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
          />
          <button
            onClick={() => setCalcOpen((v) => !v)}
            title="Calculadora de conteo"
            style={{ width: 48, height: 48, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .13s', background: calcOpen ? '#6366F1' : '#EEF0FE', color: calcOpen ? '#fff' : '#6366F1', boxShadow: calcOpen ? '0 8px 18px -8px #6366F1cc' : undefined }}
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="1.8" width="10" height="12.4" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <rect x="5.2" y="4" width="5.6" height="2.4" rx="0.8" fill="currentColor" />
              <circle cx="6.1" cy="9" r="0.95" fill="currentColor" />
              <circle cx="9.9" cy="9" r="0.95" fill="currentColor" />
              <circle cx="6.1" cy="11.8" r="0.95" fill="currentColor" />
              <circle cx="9.9" cy="11.8" r="0.95" fill="currentColor" />
            </svg>
          </button>
        </div>

        {calcOpen && (
          <div style={{ marginTop: 12, border: '1.5px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--input)', animation: 'vfade .25s ease', maxHeight: 250, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.7px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Billetes</div>
            {BILLS.map(countRow)}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.7px', color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 8px' }}>Monedas</div>
            {COINS.map(countRow)}
            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Total contado</span>
              <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(counted)}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => s.confirmAperturaCaja(amount)}
          className="v-hover-primary"
          style={{ width: '100%', height: 48, marginTop: 18, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
        >
          Abrir en {s.fmt(amount)}
        </button>
        <button
          onClick={s.closeModal}
          style={{ width: '100%', height: 40, marginTop: 8, borderRadius: 10, background: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  )
}
