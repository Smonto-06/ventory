'use client'

// Documento de cotización imprimible (80 mm).
//
// Dice bien grande COTIZACIÓN y "no es factura de venta", porque en el
// mostrador un papel con precios y total se confunde con un recibo. Lleva la
// fecha hasta la que se respeta el precio, que es lo que le da valor.

import { useApp } from '../store'
import { fmtQty } from '../ui'
import { TicketLine } from '../printer'
import BotonImprimir from '../Imprimir'

export default function CotizacionReciboScreen() {
  const s = useApp()
  const c = s.quoteDet

  if (!c) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => s.go('cotizaciones')} style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
          Ir a cotizaciones →
        </button>
      </div>
    )
  }

  const fechaCorta = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric', year: '2-digit' })
  const emitida = new Date(c.createdAt).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const cliente = c.customer?.name ?? c.customerName ?? 'Sin cliente'
  const vencida = c.status === 'EXPIRED'

  const lineas = (): TicketLine[] => {
    const L: TicketLine[] = [
      { type: 'center', left: 'COTIZACIÓN', bold: true },
      { type: 'center', left: s.settings?.name ?? '' },
    ]
    if (s.settings?.taxId) L.push({ type: 'center', left: `NIT ${s.settings.taxId}` })
    if (s.settings?.phone) L.push({ type: 'center', left: `Tel. ${s.settings.phone}` })
    if (s.settings?.address) L.push({ type: 'center', left: s.settings.address })
    L.push({ type: 'center', left: emitida })
    L.push({ type: 'divider' })
    L.push({ type: 'row', left: 'Número', right: c.folio })
    L.push({ type: 'row', left: 'Cliente', right: cliente })
    L.push({ type: 'row', left: 'Válida hasta', right: fechaCorta(c.validUntil) })
    L.push({ type: 'divider' })
    for (const it of c.items) {
      const q = it.product.unitOfMeasure === 'kg' ? `${fmtQty(it.quantity)}kg` : `${fmtQty(it.quantity)}x`
      L.push({ type: 'row', left: `${q} ${it.product.name}`, right: s.fmt(it.total) })
    }
    L.push({ type: 'divider' })
    if (c.discountAmount > 0) {
      L.push({ type: 'row', left: 'Subtotal', right: s.fmt(c.subtotal) })
      L.push({ type: 'row', left: 'Descuento', right: `- ${s.fmt(c.discountAmount)}` })
    }
    L.push({ type: 'row', left: 'TOTAL', right: s.fmt(c.total), bold: true })
    if (c.notes) {
      L.push({ type: 'divider' })
      L.push({ type: 'center', left: c.notes })
    }
    L.push({ type: 'feed' })
    L.push({ type: 'center', left: 'Este documento NO es factura de venta' })
    L.push({ type: 'center', left: `Precios válidos hasta el ${fechaCorta(c.validUntil)}` })
    return L
  }

  const fila = (izq: string, der: string, opts?: { bold?: boolean; muted?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1.5px 0' }}>
      <span style={{ color: opts?.muted ? '#6E7280' : 'var(--text)', fontWeight: opts?.bold ? 700 : 400 }}>{izq}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: opts?.bold ? 700 : 400 }}>{der}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', gap: 16 }}>
      <div style={{ width: 302, background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 16px', fontFamily: "'Courier New',monospace", fontSize: 12, color: 'var(--text)', boxShadow: '0 14px 30px -20px rgba(16,20,30,.4)', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.5px' }}>COTIZACIÓN</div>
          <div style={{ color: '#6E7280', fontSize: 10.5 }}>{s.settings?.name}</div>
          {s.settings?.taxId && <div style={{ color: '#6E7280', fontSize: 10.5 }}>NIT {s.settings.taxId}</div>}
          {s.settings?.phone && <div style={{ color: '#6E7280', fontSize: 10.5 }}>Tel. {s.settings.phone}</div>}
          {s.settings?.address && <div style={{ color: '#6E7280', fontSize: 10.5 }}>{s.settings.address}</div>}
          <div style={{ color: '#6E7280', fontSize: 10.5 }}>{emitida}</div>
        </div>

        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
        {fila('Número', c.folio, { bold: true })}
        {fila('Cliente', cliente, { muted: true })}
        {fila('Válida hasta', fechaCorta(c.validUntil), { muted: true })}

        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
        {c.items.map((it) => (
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
            {(it.quantity > 1 || it.product.unitOfMeasure === 'kg' || it.discountPct > 0) && (
              <div style={{ color: '#6E7280', fontSize: 10, paddingLeft: 14, marginTop: -2 }}>
                {s.fmt(it.unitPrice)} {it.product.unitOfMeasure === 'kg' ? '/kg' : 'c/u'}
                {it.discountPct > 0 ? ` · −${it.discountPct}%` : ''}
              </div>
            )}
          </div>
        ))}

        <div style={{ borderTop: '1.5px solid var(--text)', margin: '9px 0' }} />
        {c.discountAmount > 0 && (
          <>
            {fila('Subtotal', s.fmt(c.subtotal), { muted: true })}
            {fila('Descuento', `− ${s.fmt(c.discountAmount)}`, { muted: true })}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>{s.fmt(c.total)}</span>
        </div>

        {c.notes && (
          <>
            <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
            <div style={{ fontSize: 10.5, color: '#6E7280', lineHeight: 1.5 }}>{c.notes}</div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 12, color: '#6E7280', fontSize: 10.5, lineHeight: 1.5 }}>
          Este documento <b>NO</b> es factura de venta
          <br />
          Precios válidos hasta el {fechaCorta(c.validUntil)}
          <br />
          Sistema Ventory POS
        </div>
      </div>

      {vencida && (
        <div data-no-print="true" style={{ width: 302, background: '#FDF4E5', border: '1px solid #F3DCB0', borderRadius: 11, padding: '11px 14px', fontSize: 12.8, color: '#8A6B2E', lineHeight: 1.5 }}>
          Esta cotización ya venció. Puedes convertirla igual: el sistema respeta
          los precios cotizados.
        </div>
      )}

      <div data-no-print="true" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <BotonImprimir lineas={lineas} etiqueta="Imprimir" alto={46} />
        {(c.status === 'OPEN' || c.status === 'EXPIRED') && (
          <button
            onClick={() => s.convertirCotizacion(c.id)}
            className="v-hover-primary"
            style={{ height: 46, padding: '0 18px', borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
          >
            Convertir en venta
          </button>
        )}
        <button
          onClick={() => s.go('cotizaciones')}
          className="v-hover-bg"
          style={{ height: 46, padding: '0 18px', borderRadius: 12, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Ver todas
        </button>
      </div>
    </div>
  )
}
