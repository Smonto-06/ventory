'use client'

// Pantalla COMPRAS — réplica 1:1 del prototipo (sección sCompras).

import { useApp } from '../store'
import { chipStyle } from '../ui'

const TH: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
}

const GRID = 'minmax(180px,1.6fr) minmax(150px,1fr) 120px 120px 150px'

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

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function ComprasScreen() {
  const s = useApp()

  const ncTotal = s.ncItems.reduce((a, i) => a + (i.total || 0), 0)
  const ncProds = s.ncItems.length

  const openCompra = () => {
    if (s.ncItems.length > 0) {
      s.go('nuevacompra')
      return
    }
    s.setNcProv('')
    s.setNcItems([])
    s.setNcMethod('contado')
    s.setNcAbono(0)
    s.go('nuevacompra')
  }

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Compras</h1>
        <button
          onClick={openCompra}
          className="v-hover-primary"
          style={{ height: 44, padding: '0 18px', borderRadius: 11, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
        >
          + Nueva compra
        </button>
      </div>

      {s.ncItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#EEF0FE', border: '1.5px solid #C7D0FB', borderRadius: 12, padding: '11px 16px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: '#4338CA' }}>Compra en curso</span>
          <span style={{ flex: 1, minWidth: 150, fontSize: 13.5, color: '#4338CA', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {(s.ncProv || 'Sin proveedor') + ' · ' + ncProds + (ncProds === 1 ? ' prod' : ' prods') + ' · ' + s.fmt(ncTotal)}
          </span>
          <button
            onClick={() => s.go('nuevacompra')}
            className="v-hover-primary"
            style={{ height: 36, padding: '0 14px', borderRadius: 9, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Continuar
          </button>
        </div>
      )}

      {s.heldPurchases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.heldPurchases.map((h) => {
            const n = h.payload?.items?.length ?? 0
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FDF4E5', border: '1.5px solid #F3DCB0', borderRadius: 12, padding: '11px 16px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13.5, color: '#8A6B2E' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
                    <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
                  </svg>
                  En espera
                </span>
                <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, color: '#7A5E1F', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {(h.supplierName || 'Sin proveedor') + ' · ' + n + (n === 1 ? ' prod' : ' prods') + ' · ' + s.fmt(h.total) + ' · ' + fmtTime(h.createdAt)}
                </span>
                <button
                  onClick={() => s.resumePurchase(h.id)}
                  className="v-hover-primary"
                  style={{ height: 36, padding: '0 14px', borderRadius: 9, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Reanudar
                </button>
                <button
                  onClick={() =>
                    s.askConfirm({
                      title: '¿Eliminar esta espera?',
                      label: `Compra · ${h.supplierName || 'Sin proveedor'} · ${s.fmt(h.total)}`,
                      btnLabel: 'Eliminar',
                      onConfirm: () => s.discardHeldPurchase(h.id),
                    })
                  }
                  style={{ width: 32, height: 32, borderRadius: 9, background: '#FDECEC', color: '#C9433B', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)', overflowX: 'auto' }}>
        <div style={{ minWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', background: 'var(--surface2)', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
            <div style={TH}>Proveedor</div>
            <div style={TH}>Fecha</div>
            <div style={{ ...TH, textAlign: 'right' }}>Valor</div>
            <div style={{ ...TH, textAlign: 'right' }}>Pago/Abono</div>
            <div style={{ ...TH, textAlign: 'right' }}>Saldo pendiente</div>
          </div>
          {s.purchases.map((c) => {
            const saldo = c.balance
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
                <button
                  onClick={() => {
                    s.setCompraDetId(c.id)
                    s.openModal('compraDetalle')
                  }}
                  title="Ver detalle de la compra"
                  className="v-hover-underline"
                  style={{ padding: '13px 10px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', background: 'none' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF0FE', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flex: 'none' }}>
                    {c.supplier.name[0] ?? '?'}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.supplier.name}</span>
                </button>
                <div style={{ padding: '13px 10px', fontSize: 13.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(c.createdAt)}</div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(c.total)}</div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13.5, color: '#6366F1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(c.paidAmount)}</div>
                <div style={{ padding: '13px 10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <span style={saldo > 0 ? chipStyle('#FDF4E5', '#B4740A') : { color: 'var(--muted)', fontWeight: 600, fontSize: 13.5 }}>
                    {saldo > 0 ? s.fmt(saldo) : '$ 0'}
                  </span>
                  {saldo > 0 && (
                    <button
                      onClick={() => {
                        s.setAbonoCompraId(c.id)
                        s.openModal('abonoCompra')
                      }}
                      title="Registrar pago al proveedor"
                      style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: '#EEF0FE', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .13s' }}
                    >
                      <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                        <rect x="1.5" y="4" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
