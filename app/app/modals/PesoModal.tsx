'use client'

// Modal de peso — para productos vendidos por kg: teclado numérico tipo
// calculadora (solo dígitos, coma decimal y borrar) con el valor calculado
// en vivo al precio por kilo. También acepta el teclado físico.

import { useState } from 'react'
import { useApp } from '../store'
import { fmtQty, parseQty } from '../ui'
import { Icono } from '@/components/Icono'
import TecladoPeso, { aplicarTecla, useTecladoFisico } from './TecladoPeso'

export default function PesoModal() {
  const s = useApp()
  const p = s.pesoProduct
  const existing = p ? s.cart.find((i) => i.productId === p.id) : undefined
  const [raw, setRaw] = useState<string>(existing ? String(existing.qty).replace('.', ',') : '')

  const press = (k: string) => setRaw((r) => aplicarTecla(r, k))
  useTecladoFisico(press)

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
        style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
      >
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: '#6366F1' }}>
            <Icono n="balanza" tam={20} />
          </span>
          {p.name}
        </h2>
        <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)' }}>
          {s.fmt(p.price)} por kilo
        </div>

        {/* Pantalla de la calculadora: peso digitado + valor en vivo */}
        <div style={{ marginTop: 16, background: '#0F172A', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>Peso</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px' }}>
              {raw || '0'}<span style={{ fontSize: 15, color: '#7EA6A0', fontWeight: 700 }}> kg</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, borderTop: '1px solid #1E293B', paddingTop: 8 }}>
            <span style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>
              {ok ? `${fmtQty(kg)} kg × ${s.fmt(p.price)}` : 'Valor'}
            </span>
            <span style={{ fontSize: 21, fontWeight: 800, color: '#A5B4FC', fontVariantNumeric: 'tabular-nums' }}>
              {s.fmt(total)}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <TecladoPeso onTecla={press} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
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
