'use client'

// Modal de peso — para productos vendidos por kg: se digita el peso
// (acepta coma o punto) y se ve el valor calculado al precio por kilo.

import { useState } from 'react'
import { useApp } from '../store'
import { fmtQty, parseQty } from '../ui'

const QUICK = [0.25, 0.5, 1, 2]

export default function PesoModal() {
  const s = useApp()
  const p = s.pesoProduct
  const existing = p ? s.cart.find((i) => i.productId === p.id) : undefined
  const [raw, setRaw] = useState<string>(existing ? String(existing.qty).replace('.', ',') : '')

  if (!p) return null

  const kg = parseQty(raw)
  const total = Math.round(p.price * kg)
  const ok = kg > 0

  return (
    <div
      data-no-print="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={s.closeModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
      >
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>⚖ {p.name}</h2>
        <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)' }}>
          {s.fmt(p.price)} por kilo
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '16px 0 6px' }}>
          Peso en kilogramos
        </label>
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          inputMode="decimal"
          autoFocus
          placeholder="0,750"
          style={{ width: '100%', height: 52, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--input)', fontSize: 20, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setRaw(String(q).replace('.', ','))}
              style={{ flex: 1, height: 40, borderRadius: 10, background: '#EEF0FE', color: '#4338CA', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
            >
              {q < 1 ? `${q * 1000} g` : `${q} kg`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', marginTop: 14 }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>
            {ok ? `${fmtQty(kg)} kg × ${s.fmt(p.price)}` : 'Valor'}
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>
            {s.fmt(total)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={s.closeModal} style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={() => s.confirmPeso(kg)}
            disabled={!ok}
            className="v-hover-primary"
            style={{ flex: 1.4, height: 48, borderRadius: 12, background: ok ? '#6366F1' : '#C7CDEC', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: ok ? 'pointer' : 'not-allowed', boxShadow: ok ? '0 8px 18px -8px #6366F1cc' : undefined }}
          >
            {existing ? 'Actualizar peso' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    </div>
  )
}
