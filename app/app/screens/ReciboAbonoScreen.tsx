'use client'

// Recibo de abono (cliente o proveedor) — réplica 1:1 del prototipo (sReciboAbono).

import { useApp } from '../store'
import BotonImprimir from '../Imprimir'
import { TicketLine } from '../printer'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

export default function ReciboAbonoScreen() {
  const s = useApp()
  const ab = s.lastAbono
  if (!ab) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => s.go('panel')} style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
          Ir al panel →
        </button>
      </div>
    )
  }

  const dateStr = new Date(ab.date).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const reciboLines = (): TicketLine[] => [
    { type: 'center', left: ab.type === 'cliente' ? 'ABONO DE CLIENTE' : 'PAGO A PROVEEDOR', bold: true },
    { type: 'center', left: s.settings?.name ?? '' },
    { type: 'center', left: dateStr },
    { type: 'divider' },
    { type: 'row', left: ab.type === 'cliente' ? 'Cliente' : 'Proveedor', right: ab.name },
    { type: 'row', left: 'Método', right: METHOD_LABELS[ab.method] ?? ab.method },
    { type: 'divider' },
    { type: 'row', left: 'MONTO ABONADO', right: s.fmt(ab.amount), bold: true },
    { type: 'row', left: 'Saldo restante', right: s.fmt(ab.balance) },
    { type: 'feed' },
    { type: 'center', left: 'Sistema Ventory POS' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(900px 500px at 50% -5%, #EEF0FE 0%, var(--bg) 55%)' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 50px -30px rgba(16,20,30,.28)', animation: 'vpop .35s ease' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', boxShadow: '0 10px 22px -8px #6366F199' }}>
            ✓
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 14 }}>
            {ab.type === 'cliente' ? 'Abono de cliente' : 'Pago a proveedor'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{dateStr}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', margin: '20px 0 14px', fontSize: 13.5 }}>
          <div>{ab.name}</div>
          <div>
            Método: <b>{METHOD_LABELS[ab.method] ?? ab.method}</b>
          </div>
        </div>
        <div style={{ textAlign: 'center', margin: '18px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Monto abonado</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{s.fmt(ab.amount)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 12, borderTop: '1px dashed #E2E5EC' }}>
          <span style={{ color: 'var(--muted)' }}>Saldo restante</span>
          <span style={{ fontWeight: 800, color: '#B4740A', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(ab.balance)}</span>
        </div>
        <div data-no-print="true" style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <BotonImprimir lineas={reciboLines} etiqueta="Imprimir recibo" alto={50} flex={1} />
          <button
            onClick={() => s.go(ab.type === 'proveedor' ? 'compras' : 'clientes')}
            className="v-hover-primary"
            style={{ flex: 1.2, height: 50, borderRadius: 13, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc' }}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )
}
