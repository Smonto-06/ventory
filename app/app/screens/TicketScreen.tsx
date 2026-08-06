'use client'

// Ticket 80mm imprimible — factura de venta "compacta completa":
// datos del negocio (NIT, dirección, teléfono desde Ajustes), cajero y
// sucursal, precio unitario cuando la cantidad > 1, IVA incluido y
// mensaje final configurable. Las líneas sin dato no se imprimen.

import { useApp } from '../store'
import { methodLabel, fmtQty } from '../ui'
import { TicketLine } from '../printer'
import BotonImprimir from '../Imprimir'

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

  // Ticket en formato ESC/POS para impresora térmica (mismo contenido)
  const ticketLines = (): TicketLine[] => {
    const L: TicketLine[] = [{ type: 'center', left: (st?.name ?? '').toUpperCase(), bold: true }]
    if (st?.taxId) L.push({ type: 'center', left: `NIT ${st.taxId}` })
    if (st?.address) L.push({ type: 'center', left: st.address })
    if (st?.phone) L.push({ type: 'center', left: `Tel ${st.phone}` })
    L.push({ type: 'divider' })
    L.push({ type: 'row', left: `Fact ${sale.folio}`, right: dateStr })
    if (sale.cashier?.name || branchName) L.push({ type: 'row', left: sale.cashier?.name ?? '', right: branchName })
    L.push({ type: 'divider' })
    for (const it of sale.items) {
      const q = it.product.unitOfMeasure === 'kg' ? `${fmtQty(it.quantity)}kg` : `${fmtQty(it.quantity)}x`
      L.push({ type: 'row', left: `${q} ${it.product.name}`, right: s.fmt(it.total) })
      if (it.product.unitOfMeasure === 'kg') L.push({ type: 'row', left: '', right: `${s.fmt(it.unitPrice)}/kg` })
      else if (it.quantity > 1) L.push({ type: 'row', left: '', right: `${s.fmt(it.unitPrice)} c/u` })
    }
    L.push({ type: 'divider' })
    if (sale.discountAmount > 0) {
      L.push({ type: 'row', left: 'Subtotal', right: s.fmt(sale.subtotal) })
      L.push({ type: 'row', left: 'Descuento', right: '-' + s.fmt(sale.discountAmount) })
    }
    L.push({ type: 'row', left: 'TOTAL', right: s.fmt(sale.total), bold: true })
    if (sale.taxAmount > 0) L.push({ type: 'row', left: ivaLabel, right: s.fmt(sale.taxAmount) })
    if (sale.paymentMethod === 'MIXED') {
      for (const p of sale.payments) L.push({ type: 'row', left: methodLabel(p.method), right: s.fmt(p.amount) })
    } else if (sale.paymentMethod === 'CASH') {
      L.push({ type: 'row', left: 'Efectivo', right: s.fmt(sale.amountPaid) })
    } else {
      L.push({ type: 'row', left: methodLabel(sale.paymentMethod, sale.payments), right: s.fmt(sale.total) })
    }
    if (sale.changeGiven > 0) L.push({ type: 'row', left: 'Cambio', right: s.fmt(sale.changeGiven) })
    L.push({ type: 'feed' })
    L.push({ type: 'center', left: st?.receiptFooter || '¡Gracias por su compra!' })
    L.push({ type: 'center', left: 'Sistema Ventory POS' })
    return L
  }

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
                <span style={{ color: '#6E7280' }}>
                  {it.product.unitOfMeasure === 'kg' ? `${fmtQty(it.quantity)} kg` : `${fmtQty(it.quantity)}×`}
                </span>{' '}
                {it.product.name}
              </span>
              <span>{s.fmt(it.total)}</span>
            </div>
            {it.product.unitOfMeasure === 'kg' ? (
              <div style={{ color: '#6E7280', fontSize: 10, paddingLeft: 14, marginTop: -2 }}>
                {s.fmt(it.unitPrice)} /kg
              </div>
            ) : (
              it.quantity > 1 && (
                <div style={{ color: '#6E7280', fontSize: 10, paddingLeft: 14, marginTop: -2 }}>
                  {s.fmt(it.unitPrice)} c/u
                </div>
              )
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
        <BotonImprimir lineas={ticketLines} etiqueta="Imprimir ticket" alto={50} flex={1} />
      </div>
    </div>
  )
}
