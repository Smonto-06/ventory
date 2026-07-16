'use client'

// Ticket 80mm imprimible — factura de venta "compacta completa":
// datos del negocio (NIT, dirección, teléfono desde Ajustes), cajero y
// sucursal, precio unitario cuando la cantidad > 1, IVA incluido y
// mensaje final configurable. Las líneas sin dato no se imprimen.

import { useApp } from '../store'
import { methodLabel } from '../ui'

export default function TicketScreen() {
  const s = useApp()
  const sale = s.lastSale
  if (!sale) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => s.go('pos')} style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
          Ir al punto de venta →
        </button>
      </div>
    )
  }

  // Año a 2 dígitos para que folio y fecha quepan en una sola línea del ticket
  const dateStr = new Date(sale.createdAt).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const st = s.settings
  const branchName = sale.branch?.name ?? s.cash.session?.branch.name ?? ''
  const ivaLabel = st?.ivaPct ? `IVA incluido (${st.ivaPct}%)` : 'IVA incluido'

  const metaRow = (left: string, right: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#6E7280' }}>
      <span style={{ whiteSpace: 'nowrap' }}>{left}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )

  const payRow = (label: string, value: string) => (
    <div key={label + value} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#6E7280', padding: '1px 0' }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, background: 'var(--bg)', gap: 16 }}>
      <div style={{ width: 302, background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 16px', fontFamily: "'Courier New',monospace", fontSize: 12, color: 'var(--text)', boxShadow: '0 14px 30px -20px rgba(16,20,30,.4)', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{st?.name}</div>
          {st?.taxId && <div style={{ color: '#6E7280', fontSize: 10.5 }}>NIT {st.taxId}</div>}
          {st?.address && <div style={{ color: '#6E7280', fontSize: 10.5 }}>{st.address}</div>}
          {st?.phone && <div style={{ color: '#6E7280', fontSize: 10.5 }}>Tel {st.phone}</div>}
        </div>

        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
        {metaRow(`Factura ${sale.folio}`, dateStr)}
        {(sale.cashier?.name || branchName) &&
          metaRow(sale.cashier?.name ? `Cajero: ${sale.cashier.name}` : '', branchName)}
        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />

        {sale.items.map((it) => (
          <div key={it.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1.5px 0' }}>
              <span>
                <span style={{ color: '#6E7280' }}>{it.quantity}×</span> {it.product.name}
              </span>
              <span>{s.fmt(it.total)}</span>
            </div>
            {it.quantity > 1 && (
              <div style={{ color: '#6E7280', fontSize: 10, paddingLeft: 14, marginTop: -2 }}>
                {s.fmt(it.unitPrice)} c/u
              </div>
            )}
          </div>
        ))}

        <div style={{ borderTop: '1.5px solid var(--text)', margin: '9px 0' }} />
        {sale.discountAmount > 0 && (
          <>
            {payRow('Subtotal', s.fmt(sale.subtotal))}
            {payRow('Descuento', '− ' + s.fmt(sale.discountAmount))}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>{s.fmt(sale.total)}</span>
        </div>
        {sale.taxAmount > 0 && payRow(ivaLabel, s.fmt(sale.taxAmount))}

        {sale.paymentMethod === 'MIXED' ? (
          sale.payments.map((p) => payRow(methodLabel(p.method), s.fmt(p.amount)))
        ) : sale.paymentMethod === 'CASH' ? (
          payRow('Efectivo', s.fmt(sale.amountPaid))
        ) : (
          payRow(methodLabel(sale.paymentMethod, sale.payments), s.fmt(sale.total))
        )}
        {sale.changeGiven > 0 && payRow('Cambio', s.fmt(sale.changeGiven))}

        <div style={{ textAlign: 'center', marginTop: 12, color: '#6E7280', fontSize: 10.5 }}>
          {st?.receiptFooter || '¡Gracias por su compra!'}
          <br />
          Sistema Ventory POS
        </div>
      </div>
      <div data-no-print="true" style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => s.go('receipt')} className="v-hover-bg" style={{ height: 46, padding: '0 18px', borderRadius: 12, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          ← Volver
        </button>
        <button onClick={() => window.print()} className="v-hover-primary" style={{ height: 46, padding: '0 20px', borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}>
          Imprimir ticket
        </button>
      </div>
    </div>
  )
}
