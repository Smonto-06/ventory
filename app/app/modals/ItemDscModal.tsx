'use client'

// Descuento por artículo (%) — réplica 1:1 del prototipo (mItemDsc).

import { useState } from 'react'
import { useApp } from '../store'
import CampoNumerico from './CampoNumerico'

export default function ItemDscModal() {
  const s = useApp()
  const item = s.cart.find((i) => i.productId === s.dscId)
  const [val, setVal] = useState(item?.dscPct ?? 0)

  if (!item) return null

  return (
    <div
      data-no-print="true"
      onClick={s.closeModal}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Descuento del artículo</h2>
        <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)' }}>{item.name}</div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '11px 0 5px' }}>
          % de descuento (0–100)
        </label>
        <CampoNumerico
          value={val || ''}
          onChange={(raw) => setVal(Math.min(100, parseInt(raw.replace(/\D/g, '')) || 0))}
          placeholder="0"
          titulo="% de descuento del artículo"
          style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={s.closeModal} style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={() => {
              s.setItemDsc(item.productId, val)
              s.closeModal()
            }}
            className="v-hover-primary"
            style={{ flex: 1.3, height: 46, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
