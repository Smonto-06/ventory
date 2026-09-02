'use client'

// Editar precio del artículo, solo para esta venta — no toca el catálogo.
// Teclado numérico propio (igual que peso y cantidad): no depende del
// teclado del sistema, que en algunos celulares y en pantallas táctiles sin
// teclado físico no aparece de forma confiable.

import { useState } from 'react'
import { useApp } from '../store'
import TecladoPeso, { aplicarTecla, useTecladoFisico } from './TecladoPeso'

export default function ItemPrecioModal() {
  const s = useApp()
  const item = s.cart.find((i) => i.productId === s.dscId)
  // En blanco a propósito, igual que el teclado de cantidad: precargar el
  // precio actual obligaría a borrarlo antes de escribir el nuevo.
  const [raw, setRaw] = useState('')

  const press = (k: string) => setRaw((r) => aplicarTecla(r, k))
  useTecladoFisico(press)

  if (!item) return null

  const nuevoPrecio = parseInt(raw.replace(/\D/g, '')) || 0
  const ok = nuevoPrecio > 0

  const confirmar = () => {
    if (!ok) return
    s.setItemPrice(item.productId, nuevoPrecio)
    s.closeModal()
  }

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
        <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)' }}>
          {item.name} · actual {s.fmt(item.price)}
        </div>

        <div style={{ marginTop: 16, background: '#0F172A', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>Precio, solo para esta venta</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px' }}>
              {raw || '0'}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <TecladoPeso onTecla={press} decimales={false} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={s.closeModal} style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!ok}
            className="v-hover-primary"
            style={{ flex: 1.4, height: 48, borderRadius: 12, background: ok ? '#6366F1' : '#C7CDEC', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: ok ? 'pointer' : 'not-allowed', boxShadow: ok ? '0 8px 18px -8px #6366F1cc' : undefined }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
