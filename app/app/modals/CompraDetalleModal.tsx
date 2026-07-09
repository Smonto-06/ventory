'use client'

// Modal DETALLE DE COMPRA — réplica 1:1 del prototipo (mCompraDet).

import { useApp } from '../store'
import { Modal } from '../ui'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Contado',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function CompraDetalleModal() {
  const s = useApp()
  const compra = s.purchases.find((c) => c.id === s.compraDetId)
  if (!compra) return null

  return (
    <Modal onClose={s.closeModal} maxWidth={440}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{compra.supplier.name}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDate(compra.createdAt)} · {METHOD_LABELS[compra.method] ?? 'Contado'}
          </div>
        </div>
        <button
          onClick={s.closeModal}
          className="v-hover-bg"
          style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg)', color: '#5A616E', fontSize: 17, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
        >
          ×
        </button>
      </div>
      {compra.items.length > 0 ? (
        <div style={{ borderTop: '1px dashed #E2E5EC', borderBottom: '1px dashed #E2E5EC', padding: '6px 0', marginTop: 14 }}>
          {compra.items.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text)' }}>
                {it.product.name} × {it.quantity}{' '}
                <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>· {s.fmt(it.unitCost)} c/u</span>
              </span>
              <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(it.totalCost)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14, padding: 20, background: 'var(--bg)', borderRadius: 11, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
          Compra registrada sin detalle de productos.
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '5px 0' }}>
          <span style={{ color: 'var(--muted)' }}>Valor</span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(compra.total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '5px 0' }}>
          <span style={{ color: 'var(--muted)' }}>Pago/Abono</span>
          <span style={{ color: '#6366F1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(compra.paidAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px dashed #E2E5EC' }}>
          <span style={{ fontWeight: 800, fontSize: 14.5 }}>Saldo pendiente</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#B4740A', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(compra.balance)}</span>
        </div>
      </div>
    </Modal>
  )
}
