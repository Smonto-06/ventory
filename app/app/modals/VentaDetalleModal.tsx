'use client'

// Modal de detalle de venta — réplica 1:1 del prototipo (mVentaDet).

import { useApp } from '../store'
import { Modal, chipStyle, methodTint, methodLabel } from '../ui'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

export default function VentaDetalleModal() {
  const s = useApp()
  const sale = s.sales.find((v) => v.id === s.saleDetId)
  if (!sale) return null

  const anulada = sale.status === 'CANCELLED'
  const label = methodLabel(sale.paymentMethod, sale.payments)
  const [mBg, mFg] = methodTint(label)

  return (
    <Modal onClose={s.closeModal} maxWidth={460}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', color: '#6366F1' }}>{sale.folio}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{fmtDate(sale.createdAt)}</div>
        </div>
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
            flex: 'none',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <span style={chipStyle(mBg, mFg)}>{label}</span>
        {anulada && <span style={chipStyle('#FDECEC', '#C9433B')}>Anulada</span>}
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Cliente: <b style={{ color: 'var(--text)' }}>{sale.customer?.name ?? 'Sin cliente'}</b>
        </span>
      </div>

      <div style={{ borderTop: '1px dashed #E2E5EC', borderBottom: '1px dashed #E2E5EC', padding: '6px 0', marginTop: 14 }}>
        {sale.items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', fontSize: 14 }}>
            <span style={{ color: 'var(--text)' }}>
              {it.product.name} × {it.quantity}
              {it.returnedQty > 0 && (
                <span style={{ color: '#C9433B', fontSize: 12.5 }}>
                  {` · ${it.returnedQty} devuelto${it.returnedQty > 1 ? 's' : ''}`}
                </span>
              )}
            </span>
            <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(it.total)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Total</span>
        <span style={{ fontSize: 21, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(sale.total)}</span>
      </div>

      {!anulada && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              onClick={() => s.openModal('devolucion')}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                background: '#FDF4E5',
                color: '#B4740A',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Devolver artículos
            </button>
            <button
              onClick={() =>
                s.askConfirm({
                  title: '¿Anular esta venta?',
                  label: `${sale.folio} · ${s.fmt(sale.total)} · Se regresa el stock y se descuenta de caja`,
                  btnLabel: 'Anular',
                  onConfirm: () => s.doVoid(sale.id),
                })
              }
              style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                background: '#FDECEC',
                color: '#C9433B',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Anular venta
            </button>
          </div>
          <button
            onClick={() => {
              s.setLastSale(sale)
              s.closeModal()
              s.go('receipt')
            }}
            className="v-hover-bg"
            style={{
              width: '100%',
              height: 46,
              marginTop: 8,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Reimprimir
          </button>
        </>
      )}
    </Modal>
  )
}
