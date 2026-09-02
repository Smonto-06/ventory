'use client'

// Editar precio del artículo, solo para esta venta — no toca el catálogo.

import { useState } from 'react'
import { useApp } from '../store'

export default function ItemPrecioModal() {
  const s = useApp()
  const item = s.cart.find((i) => i.productId === s.dscId)
  const [val, setVal] = useState(String(item?.price ?? 0))

  if (!item) return null

  const nuevoPrecio = parseInt(val.replace(/\D/g, '')) || 0

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
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Precio del artículo</h2>
        <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)' }}>
          {item.name} · precio actual {s.fmt(item.price)} c/u
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '11px 0 5px' }}>
          Nuevo precio, solo para esta venta
        </label>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="0"
          autoFocus
          style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={s.closeModal} style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (nuevoPrecio <= 0) return
              s.setItemPrice(item.productId, nuevoPrecio)
              s.closeModal()
            }}
            disabled={nuevoPrecio <= 0}
            className="v-hover-primary"
            style={{ flex: 1.3, height: 46, borderRadius: 12, background: nuevoPrecio > 0 ? '#6366F1' : '#C7CDEC', color: '#fff', fontWeight: 800, fontSize: 14, cursor: nuevoPrecio > 0 ? 'pointer' : 'not-allowed' }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
