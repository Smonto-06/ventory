'use client'

// Recibo de compra 80mm imprimible — se muestra al concluir una compra:
// proveedor, productos ingresados al inventario (con costo unitario),
// total de la factura, método de pago y saldo pendiente si fue a crédito.

import { useApp } from '../store'
import { fmtQty } from '../ui'
import { TicketLine } from '../printer'
import BotonImprimir from '../Imprimir'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Contado (efectivo)',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

export default function CompraReciboScreen() {
  const s = useApp()
  const p = s.lastPurchase

  if (!p) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => s.go('compras')} style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
          Ir a compras →
        </button>
      </div>
    )
  }

  const dateStr = new Date(p.createdAt).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const units = p.items.reduce((a, it) => a + Number(it.quantity), 0)

  const kv = (label: string, value: string, opts?: { muted?: boolean; bold?: boolean; color?: string }) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1.5px 0' }}>
      <span style={{ color: opts?.muted ? '#6E7280' : 'var(--text)', fontWeight: opts?.bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: opts?.bold ? 700 : 400, color: opts?.color ?? (opts?.muted ? '#6E7280' : 'var(--text)') }}>
        {value}
      </span>
    </div>
  )

  const reciboLines = (): TicketLine[] => {
    const L: TicketLine[] = [
      { type: 'center', left: 'COMPRA DE MERCANCÍA', bold: true },
      { type: 'center', left: s.settings?.name ?? '' },
      { type: 'center', left: dateStr },
      { type: 'divider' },
      { type: 'row', left: 'Proveedor', right: p.supplier.name },
      { type: 'divider' },
    ]
    for (const it of p.items) {
      const q = it.product.unitOfMeasure === 'kg' ? `${fmtQty(it.quantity)}kg` : `${fmtQty(it.quantity)}x`
      L.push({ type: 'row', left: `${q} ${it.product.name}`, right: s.fmt(it.totalCost) })
    }
    L.push({ type: 'divider' })
    L.push({ type: 'row', left: 'TOTAL', right: s.fmt(p.total), bold: true })
    L.push({ type: 'row', left: 'Método', right: METHOD_LABELS[p.method] ?? p.method })
    if (p.method === 'CREDIT') {
      L.push({ type: 'row', left: 'Abonado', right: s.fmt(p.paidAmount) })
      L.push({ type: 'row', left: 'Saldo pendiente', right: s.fmt(p.balance), bold: true })
    }
    L.push({ type: 'feed' })
    L.push({ type: 'center', left: `${fmtQty(units)} unidades al inventario` })
    return L
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', gap: 16 }}>
      <div style={{ width: 302, background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 16px', fontFamily: "'Courier New',monospace", fontSize: 12, color: 'var(--text)', boxShadow: '0 14px 30px -20px rgba(16,20,30,.4)', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.5px' }}>COMPRA DE MERCANCÍA</div>
          <div style={{ color: '#6E7280', fontSize: 10.5 }}>{s.settings?.name}</div>
          <div style={{ color: '#6E7280', fontSize: 10.5 }}>{dateStr}</div>
        </div>

        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#6E7280' }}>
          <span style={{ whiteSpace: 'nowrap' }}>Proveedor:</span>
          <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{p.supplier.name}</span>
        </div>

        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
        {p.items.map((it) => (
          <div key={it.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1.5px 0' }}>
              <span>
                <span style={{ color: '#6E7280' }}>
                  {it.product.unitOfMeasure === 'kg' ? `${fmtQty(it.quantity)} kg` : `${fmtQty(it.quantity)}×`}
                </span>{' '}
                {it.product.name}
              </span>
              <span>{s.fmt(it.totalCost)}</span>
            </div>
            {(it.quantity > 1 || it.product.unitOfMeasure === 'kg') && (
              <div style={{ color: '#6E7280', fontSize: 10, paddingLeft: 14, marginTop: -2 }}>
                {s.fmt(it.unitCost)} {it.product.unitOfMeasure === 'kg' ? '/kg' : 'c/u'}
              </div>
            )}
          </div>
        ))}

        <div style={{ borderTop: '1.5px solid var(--text)', margin: '9px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>{s.fmt(p.total)}</span>
        </div>
        {kv('Método', METHOD_LABELS[p.method] ?? p.method, { muted: true })}
        {p.method === 'CREDIT' && (
          <>
            {kv('Abonado', s.fmt(p.paidAmount), { muted: true })}
            {kv('Saldo pendiente', s.fmt(p.balance), { bold: true, color: p.balance > 0 ? '#B4740A' : undefined })}
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 12, color: '#6E7280', fontSize: 10.5 }}>
          ✓ {fmtQty(units)} {units === 1 ? 'unidad ingresada' : 'unidades ingresadas'} al inventario
          <br />
          Sistema Ventory POS
        </div>
      </div>

      <div data-no-print="true" style={{ display: 'flex', gap: 10 }}>
        <BotonImprimir lineas={reciboLines} etiqueta="Imprimir recibo" alto={46} />
        <button
          onClick={() => s.go('nuevacompra')}
          className="v-hover-bg"
          style={{ height: 46, padding: '0 18px', borderRadius: 12, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Nueva compra
        </button>
        <button
          onClick={() => s.go('compras')}
          className="v-hover-primary"
          style={{ height: 46, padding: '0 20px', borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
        >
          Volver a compras
        </button>
      </div>
    </div>
  )
}
