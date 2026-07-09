'use client'

// Ventas en espera — réplica 1:1 del prototipo (sección sEsperas).

import { useApp } from '../store'

export default function EsperasScreen() {
  const s = useApp()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ height: 56, flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 clamp(14px,3vw,24px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={() => s.go('pos')} style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#5A616E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          ← Volver
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16, letterSpacing: '-.2px' }}>Ventas en espera</div>
        <div style={{ width: 70 }} />
      </header>
      <div style={{ flex: 1, padding: 'clamp(16px,3vw,28px)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          {s.heldSales.length > 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)', overflow: 'hidden' }}>
              {s.heldSales.map((h) => {
                const clientName = h.customerName?.trim() || 'Sin cliente'
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #EEF2F7', flexWrap: 'wrap' }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#FDF4E5', color: '#B4740A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flex: 'none' }}>
                      {h.customerName?.trim() ? h.customerName.trim()[0].toUpperCase() : '—'}
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{clientName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                        {h.itemCount} {h.itemCount === 1 ? 'art.' : 'arts.'} ·{' '}
                        {new Date(h.createdAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(h.total)}</div>
                    <button
                      onClick={() => s.resumeSale(h.id)}
                      className="v-hover-primary"
                      style={{ height: 40, padding: '0 18px', borderRadius: 10, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
                    >
                      Reanudar
                    </button>
                    <button
                      onClick={() =>
                        s.askConfirm({
                          title: '¿Eliminar esta espera?',
                          label: `Venta · ${clientName} · ${h.itemCount} ${h.itemCount === 1 ? 'art.' : 'arts.'} · ${s.fmt(h.total)}`,
                          btnLabel: 'Eliminar',
                          onConfirm: () => s.discardHeldSale(h.id),
                        })
                      }
                      style={{ width: 36, height: 36, borderRadius: 10, background: '#FDECEC', color: '#C9433B', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)', padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
              No hay ventas en espera.
              <br />
              <span style={{ fontSize: 13.5 }}>
                Desde el punto de venta, toca {'"'}Espera{'"'} con una venta en curso para guardarla aquí.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
