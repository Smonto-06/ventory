'use client'

// Pantalla PROVEEDORES — réplica 1:1 del prototipo (sección sProveedores).

import { useState } from 'react'
import { useApp } from '../store'

export default function ProveedoresScreen() {
  const s = useApp()
  const [selProv, setSelProv] = useState<string | null>(null)

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Proveedores</h1>
        <button
          onClick={() => {
            s.setEditProvId(null)
            s.openModal('proveedor')
          }}
          className="v-hover-primary"
          style={{ height: 44, padding: '0 18px', borderRadius: 11, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
        >
          + Nuevo proveedor
        </button>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)', overflow: 'hidden' }}>
        {s.suppliers.map((pv) => {
          const prods = s.products.filter((p) => p.supplier === pv.name)
          const expanded = selProv === pv.id
          return (
            <div key={pv.id}>
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #EEF2F7' }}>
                <button
                  onClick={() => setSelProv(expanded ? null : pv.id)}
                  className="v-hover-row"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 20px', cursor: 'pointer', textAlign: 'left', background: 'var(--surface)', minWidth: 0 }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EEF0FE', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>
                    {pv.name[0] ?? '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{pv.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{pv.phone ?? ''}</div>
                  </div>
                  <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: '#EEF2F7', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {prods.length + (prods.length === 1 ? ' producto' : ' productos')}
                  </span>
                  <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 13 }}>{expanded ? '▴' : '▾'}</span>
                </button>
                <button
                  onClick={() => {
                    s.setEditProvId(pv.id)
                    s.openModal('proveedor')
                  }}
                  className="v-hover-border"
                  style={{ margin: '0 14px', height: 34, padding: '0 13px', borderRadius: 9, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flex: 'none' }}
                >
                  Editar
                </button>
              </div>
              {expanded && (
                <div style={{ background: 'var(--surface2)', borderBottom: '1px solid #EEF2F7', padding: '6px 20px 10px 72px' }}>
                  {prods.length > 0 ? (
                    prods.map((pp) => (
                      <div key={pp.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid #EEF2F7', fontSize: 13.5, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>
                          {pp.name} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {pp.sku}</span>
                        </span>
                        <span style={{ color: 'var(--muted)' }}>
                          Stock {pp.stock} · <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(pp.price)}</b>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13.5 }}>Sin productos asociados.</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
