'use client'

// Modal de devolución por artículo — réplica 1:1 del prototipo (mDevolucion / devRows).

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, saveBtnStyle, fmtQty, parseQty } from '../ui'
import TecladoPeso, { aplicarTecla, useTecladoFisico } from './TecladoPeso'

export default function DevolucionModal() {
  const s = useApp()
  const [qty, setQty] = useState<Record<string, number>>({})
  // Línea por peso que se está digitando en el teclado, y lo digitado
  const [pesando, setPesando] = useState<string | null>(null)
  const [raw, setRaw] = useState('')

  const press = (k: string) => setRaw((r) => aplicarTecla(r, k))
  useTecladoFisico(press, !!pesando)

  const sale = s.sales.find((v) => v.id === s.saleDetId)
  if (!sale) return null

  // Todo en gramos (enteros): con decimales, 0,8 + 0,7 en coma flotante puede
  // dar 1,4999999 y dejar un gramo colgando.
  const aMil = (n: number) => Math.round(n * 1000)

  const rows = sale.items.map((it) => {
    const porPeso = it.product.unitOfMeasure === 'kg'
    const availMil = aMil(it.quantity) - aMil(it.returnedQty)
    const qMil = Math.min(aMil(qty[it.id] ?? 0), availMil)
    // Proporcional al valor de la línea y redondeado una sola vez: es la misma
    // cuenta que hace el servidor, para que lo que se muestra sea lo que se
    // reembolsa.
    const refund = qMil > 0 ? Math.round((it.total * qMil) / aMil(it.quantity)) : 0
    return { it, porPeso, avail: availMil / 1000, q: qMil / 1000, refund }
  })
  const devTotal = rows.reduce((a, r) => a + r.refund, 0)
  const ok = devTotal > 0
  const items = rows.filter((r) => r.q > 0).map((r) => ({ saleItemId: r.it.id, quantity: r.q }))

  const filaPesando = pesando ? rows.find((r) => r.it.id === pesando) : null

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
        {rows.map(({ it, porPeso, avail, q, refund }) => (
          <div
            key={it.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid #EEF2F7', flexWrap: 'wrap' }}
          >
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{it.product.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {porPeso
                  ? `Vendido ${fmtQty(it.quantity)} kg${it.returnedQty > 0 ? ` · ya devuelto ${fmtQty(it.returnedQty)} kg` : ''}`
                  : `Vendidos ${fmtQty(it.quantity)}${it.returnedQty > 0 ? ` · ya devueltos ${fmtQty(it.returnedQty)}` : ''}`}
              </div>
            </div>
            {porPeso ? (
              <button
                onClick={() => {
                  setPesando(it.id)
                  setRaw(q > 0 ? String(q).replace('.', ',') : '')
                }}
                className="v-hover-border"
                style={{ flex: 'none', minWidth: 96, height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${q > 0 ? '#6366F1' : 'var(--border)'}`, background: q > 0 ? '#EEF0FE' : 'var(--surface)', color: q > 0 ? '#4338CA' : 'var(--muted)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
              >
                {q > 0 ? `${fmtQty(q)} kg` : 'Pesar…'}
              </button>
            ) : (
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
            )}
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

      {filaPesando && (
        <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{filaPesando.it.product.name}</div>
          <div style={{ fontSize: 12.3, color: 'var(--muted)', marginTop: 2 }}>
            Puedes devolver hasta {fmtQty(filaPesando.avail)} kg de esta factura
          </div>

          <div style={{ marginTop: 12, background: '#0F172A', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>Devolver</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {raw || '0'}
              <span style={{ fontSize: 14, color: '#7EA6A0', fontWeight: 700 }}> kg</span>
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <TecladoPeso onTecla={press} alto={46} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setRaw(String(filaPesando.avail).replace('.', ','))}
              className="v-hover-bg"
              style={{ flex: 1, height: 42, borderRadius: 11, background: 'var(--surface)', border: '1.5px solid var(--border)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
            >
              Todo ({fmtQty(filaPesando.avail)} kg)
            </button>
            <button
              onClick={() => {
                const kg = parseQty(raw)
                if (kg > filaPesando.avail + 0.0005) {
                  s.toast(`En esta factura solo se vendieron ${fmtQty(filaPesando.avail)} kg`)
                  return
                }
                setQty((prev) => ({ ...prev, [filaPesando.it.id]: kg }))
                setPesando(null)
                setRaw('')
              }}
              className="v-hover-primary"
              style={{ flex: 1.3, height: 42, borderRadius: 11, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
            >
              Listo
            </button>
          </div>
        </div>
      )}

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
