'use client'

// Elegir la cantidad de un artículo del carrito con teclado numérico — para
// mostradores táctiles sin teclado físico. Solo unidades enteras; los
// productos por peso usan PesoModal en su lugar.

import { useState } from 'react'
import { useApp } from '../store'
import TecladoPeso, { aplicarTecla, useTecladoFisico } from './TecladoPeso'

export default function CantidadModal() {
  const s = useApp()
  const item = s.cart.find((i) => i.productId === s.dscId)
  // En blanco a propósito: los artículos siempre entran con cantidad 1, así
  // que precargarla obligaría a borrar antes de escribir la nueva cantidad.
  const [raw, setRaw] = useState('')

  const press = (k: string) => setRaw((r) => aplicarTecla(r, k))
  useTecladoFisico(press)

  if (!item) return null

  const qty = parseInt(raw.replace(/\D/g, '')) || 0
  const ok = qty > 0
  const total = Math.round(item.price * qty)

  const confirmar = () => {
    if (!ok) return
    s.setItemQty(item.productId, qty)
    s.closeModal()
  }

  return (
    <div
      data-no-print="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={s.closeModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Cantidad</h2>
        <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)' }}>
          {item.name} · actual {item.qty}
        </div>

        <div style={{ marginTop: 16, background: '#0F172A', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>Unidades</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px' }}>
              {raw || '0'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, borderTop: '1px solid #1E293B', paddingTop: 8 }}>
            <span style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>
              {ok ? `${qty} × ${s.fmt(item.price)}` : 'Valor'}
            </span>
            <span style={{ fontSize: 21, fontWeight: 800, color: '#A5B4FC', fontVariantNumeric: 'tabular-nums' }}>
              {s.fmt(total)}
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
