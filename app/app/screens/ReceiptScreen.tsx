'use client'

// Comprobante de venta — réplica 1:1 del prototipo (sección sReceipt).

import { useApp } from '../store'
import { methodLabel, fmtQty } from '../ui'

export default function ReceiptScreen() {
  const s = useApp()
  const sale = s.lastSale

  if (!sale) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={s.newSale} style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
          Ir al punto de venta →
        </button>
      </div>
    )
  }

  const dateStr = new Date(sale.createdAt).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(900px 500px at 50% -5%, #D1FAE5 0%, var(--bg) 55%)' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 50px -30px rgba(16,20,30,.28)', animation: 'vpop .35s ease' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff', boxShadow: '0 10px 22px -8px #6366F199' }}>
            ✓
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 14 }}>Venta registrada</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6366F1', letterSpacing: '.5px', marginTop: 4 }}>{sale.folio}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{dateStr}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', margin: '20px 0 14px', fontSize: 13.5 }}>
          <div>
            Sucursal: <b>{sale.branch?.name ?? s.cash.session?.branch.name ?? ''}</b>
          </div>
          <div>
            Cajero: <b>{sale.cashier?.name ?? s.me.name}</b>
          </div>
        </div>
        {sale.customer?.name && (
          <div style={{ background: '#EEF0FE', borderRadius: 12, padding: '11px 16px', fontSize: 14, color: '#4338CA', fontWeight: 700, marginBottom: 14 }}>
            Cliente: {sale.customer.name}
          </div>
        )}
        <div style={{ borderTop: '1px dashed #E2E5EC', borderBottom: '1px dashed #E2E5EC', padding: '6px 0', marginBottom: 14 }}>
          {sale.items.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text)' }}>
                {it.product.name} ×{' '}
                {it.product.unitOfMeasure === 'kg' ? `${fmtQty(it.quantity)} kg` : fmtQty(it.quantity)}
              </span>
              <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(it.total)}</span>
            </div>
          ))}
        </div>
        {sale.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#6366F1', marginBottom: 6 }}>
            <span>Descuento</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>− {s.fmt(sale.discountAmount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#6366F1' }}>Total</span>
          <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(sale.total)}</span>
        </div>
        {sale.paymentMethod === 'MIXED' ? (
          // Pago combinado: cada método con su monto (efectivo, tarjeta, transferencia)
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 22 }}>
            {sale.payments.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{methodLabel(p.method)}</span>
                <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(p.amount)}</b>
              </div>
            ))}
            {sale.changeGiven > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>Cambio</span>
                <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(sale.changeGiven)}</b>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 22 }}>
            Método: <b style={{ color: 'var(--text)' }}>{methodLabel(sale.paymentMethod, sale.payments)}</b>
            {sale.changeGiven > 0 && (
              <span>
                {' '}
                · Cambio: <b style={{ color: 'var(--text)' }}>{s.fmt(sale.changeGiven)}</b>
              </span>
            )}
          </div>
        )}
        <div data-no-print="true" style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} className="v-hover-bg" style={{ flex: 1, height: 52, borderRadius: 13, background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer', border: '1.5px solid var(--border)' }}>
            Imprimir factura
          </button>
          <button onClick={() => s.go('ticket')} className="v-hover-bg" style={{ flex: 1, height: 52, borderRadius: 13, background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer', border: '1.5px solid var(--border)' }}>
            Ticket 80mm
          </button>
          <button onClick={s.newSale} className="v-hover-primary" style={{ flex: 1.3, height: 52, borderRadius: 13, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc' }}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )
}
