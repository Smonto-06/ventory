'use client'

// Ticket 80mm imprimible — réplica 1:1 del prototipo (sección sTicket).

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

  const dateStr = new Date(sale.createdAt).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, background: 'var(--bg)', gap: 16 }}>
      <div style={{ width: 302, background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 16px', fontFamily: "'Courier New',monospace", fontSize: 12, color: 'var(--text)', boxShadow: '0 14px 30px -20px rgba(16,20,30,.4)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>VENTORY</div>
          <div>{s.settings?.name}</div>
          <div>{sale.branch?.name ?? s.cash.session?.branch.name ?? ''}</div>
          <div style={{ marginTop: 6 }}>{dateStr}</div>
          <div>Factura: {sale.folio}</div>
          <div>Cajero: {sale.cashier?.name ?? s.me.name}</div>
        </div>
        <div style={{ borderTop: '1px dashed #0F172A', margin: '10px 0' }} />
        {sale.items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
            <span>
              {it.product.name} x{it.quantity}
            </span>
            <span>{s.fmt(it.total)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #0F172A', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>{s.fmt(sale.total)}</span>
        </div>
        <div style={{ marginTop: 4 }}>Metodo: {methodLabel(sale.paymentMethod, sale.payments)}</div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>*** Gracias por su compra ***</div>
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
