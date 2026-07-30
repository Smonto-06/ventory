'use client'

// Pantalla NUEVA COMPRA (pantalla completa, sin sidebar) — réplica 1:1 del
// prototipo (sección sNuevaCompra + editor de línea ncEdit).

import { useState } from 'react'
import { useApp, NcItem } from '../store'
import { Product } from '../api'
import { tileFor, saveBtnStyle, fmtQty, parseQty } from '../ui'
import { priceFromMargin, marginFromPrice } from '@/lib/pos'

const num = (v: unknown) => parseInt(String(v ?? '').replace(/\D/g, '')) || 0

const editInputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 15,
  fontWeight: 700,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const editLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '10px 0 5px',
}

export default function NuevaCompraScreen() {
  const s = useApp()

  const [query, setQuery] = useState('')
  const [provOpen, setProvOpen] = useState(false)
  const [edit, setEdit] = useState<NcItem | null>(null)

  const openEditor = (p: Product) => {
    const cost = p.cost || 0
    const pct = cost > 0 ? marginFromPrice(cost, p.price) : 0
    setEdit({ productId: p.id, name: p.name, sku: p.sku, qty: 1, unit: cost, total: cost, pct, price: p.price })
    setQuery('')
  }

  const onQuery = (v: string) => {
    const q = v.trim().toLowerCase()
    const exact = s.products.find(
      (p) =>
        (q !== '' && (p.sku ?? '').toLowerCase() === q) ||
        ((p.barcode ?? '') !== '' && p.barcode === v.trim()),
    )
    if (exact) openEditor(exact)
    else setQuery(v)
  }

  const q = query.trim().toLowerCase()
  const results = s.products
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').includes(q),
    )
    .slice(0, 24)

  const provSuggs = s.suppliers.filter(
    (pv) => pv.name.toLowerCase().includes(s.ncProv.toLowerCase()) && pv.name !== s.ncProv,
  )
  const showProvSuggs = provOpen && provSuggs.length > 0

  const ncTotal = s.ncItems.reduce((a, i) => a + (i.total || 0), 0)
  const canSave = !!s.ncProv.trim() && s.ncItems.length > 0
  // Productos vendidos por peso: cantidades decimales (kg)
  const isKg = (productId: string) => s.products.find((p) => p.id === productId)?.unitOfMeasure === 'kg'

  const changeQty = (productId: string, d: number) => {
    s.setNcItems(
      s.ncItems
        .map((i) => {
          if (i.productId !== productId) return i
          const step = isKg(productId) ? d * 0.1 : d
          const qty = Math.round((i.qty + step) * 1000) / 1000
          return { ...i, qty, total: Math.round(qty * i.unit) }
        })
        .filter((i) => i.qty > 0),
    )
  }

  const addItem = () => {
    if (!edit || edit.qty <= 0 || edit.unit <= 0) return
    s.setNcItems([...s.ncItems.filter((i) => i.productId !== edit.productId), edit])
    setEdit(null)
  }

  const payBtns: Array<['contado' | 'transferencia' | 'credito', string]> = [
    ['contado', 'Contado'],
    ['transferencia', 'Transf.'],
    ['credito', 'Crédito'],
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <header style={{ height: 56, flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 clamp(14px,3vw,24px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <button
          onClick={() => s.go('compras')}
          className="v-hover-underline"
          style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#5A616E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          ← Volver
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16, letterSpacing: '-.2px' }}>Nueva compra</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              s.setEditProdId(null)
              s.openModal('producto')
            }}
            style={{ height: 38, padding: '0 13px', borderRadius: 10, background: '#EEF0FE', color: '#4338CA', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Producto
          </button>
          <button
            onClick={() => s.go('pos')}
            className="v-hover-border"
            style={{ height: 38, padding: '0 13px', borderRadius: 10, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Punto de venta
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Buscador + resultados */}
        <main style={{ flex: '1.35 1 360px', minWidth: 'min(100%,320px)', minHeight: 0, overflowY: 'auto', padding: 'clamp(12px,2vw,20px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar por nombre o código de barras…"
            style={{ width: '100%', height: 50, padding: '0 16px', border: '1.5px solid var(--border)', borderRadius: 13, background: 'var(--surface)', fontSize: 15, boxShadow: '0 1px 2px rgba(16,20,30,.04)' }}
          />
          {results.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(116px,1fr))', gap: 8, alignContent: 'start' }}>
              {results.map((p) => {
                const t = tileFor(p)
                return (
                  <button
                    key={p.id}
                    onClick={() => openEditor(p)}
                    className="v-hover-lift"
                    style={{ textAlign: 'left', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 13, padding: 9, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7, transition: 'all .13s' }}
                  >
                    <div style={{ height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden', ...t.tileStyle }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: t.tileFg }}>{t.tileText}</span>
                    </div>
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, minHeight: 31 }}>{p.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 3, fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>
                        <span>{p.sku}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.fmt(p.cost || 0)}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)', padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              Sin resultados para &quot;{query}&quot;. El producto debe estar creado previamente.
            </div>
          )}
        </main>

        {/* Productos recibidos */}
        <section style={{ flex: '1 1 320px', minWidth: 'min(100%,300px)', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #EEF2F7', flex: 'none', fontWeight: 800, fontSize: 16, letterSpacing: '-.2px' }}>Productos recibidos</div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 18px', minHeight: 160 }}>
            {s.ncItems.length > 0 ? (
              s.ncItems.map((it) => (
                <div key={it.productId} style={{ padding: '12px 0', borderBottom: '1px solid #EEF2F7' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <button
                      onClick={() => setEdit({ ...it })}
                      title="Editar detalle"
                      style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 14, lineHeight: 1.3, cursor: 'pointer', padding: 0, color: 'var(--text)' }}
                    >
                      {it.name}
                    </button>
                    <button
                      onClick={() => s.setNcItems(s.ncItems.filter((x) => x.productId !== it.productId))}
                      style={{ width: 26, height: 26, borderRadius: 8, background: '#FDECEC', color: '#C9433B', fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 'none' }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                      <button
                        onClick={() => changeQty(it.productId, -1)}
                        className="v-hover-bg"
                        style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 800, fontSize: isKg(it.productId) ? 12 : 14.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{isKg(it.productId) ? `${fmtQty(it.qty)} kg` : it.qty}</span>
                      <button
                        onClick={() => changeQty(it.productId, 1)}
                        style={{ width: 30, height: 30, borderRadius: 9, background: '#EEF0FE', color: '#6366F1', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(it.total || it.qty * it.unit)}</div>
                      <div style={{ fontSize: 12, color: '#4338CA', fontVariantNumeric: 'tabular-nums' }}>Venta {s.fmt(it.price)} c/u</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: '#B4BAC5', textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--muted)' }}>Aún no has ingresado productos</div>
                <div style={{ fontSize: 13, marginTop: 3 }}>Toca un producto o escanea su código</div>
              </div>
            )}
          </div>
        </section>

        {/* Proveedor + total + pago */}
        <aside style={{ flex: '0 1 300px', minWidth: 'min(100%,280px)', background: 'var(--input)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: 18, gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Proveedor</label>
            <div style={{ position: 'relative' }}>
              <input
                value={s.ncProv}
                onChange={(e) => {
                  s.setNcProv(e.target.value)
                  setProvOpen(true)
                }}
                onFocus={() => setProvOpen(true)}
                onBlur={() => setTimeout(() => setProvOpen(false), 150)}
                placeholder="Escribe el nombre…"
                style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontSize: 14.5, fontWeight: 600 }}
              />
              {showProvSuggs && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 11, boxShadow: '0 14px 30px -14px rgba(15,25,23,.35)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                  {provSuggs.map((pv) => (
                    <button
                      key={pv.id}
                      onMouseDown={() => {
                        s.setNcProv(pv.name)
                        setProvOpen(false)
                      }}
                      className="v-hover-bg"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', borderBottom: '1px solid var(--bg)', background: 'var(--surface)' }}
                    >
                      {pv.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!s.ncProv.trim() && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: '#B4740A', background: '#FDF4E5', borderRadius: 9, padding: '9px 12px' }}>
                Elige el proveedor para poder guardar la compra.
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Total compra</span>
              <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(ncTotal)}</span>
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Método de pago</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {payBtns.map(([k, l]) => {
                const active = s.ncMethod === k
                const activeColor = k === 'credito' ? '#D9820E' : '#6366F1'
                return (
                  <button
                    key={k}
                    onClick={() => s.setNcMethod(k)}
                    style={{
                      flex: 1,
                      padding: '11px 6px',
                      borderRadius: 11,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all .13s',
                      border: `1.5px solid ${active ? activeColor : 'var(--border)'}`,
                      background: active ? activeColor : 'var(--surface)',
                      color: active ? '#fff' : 'var(--text)',
                    }}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
            {s.ncMethod === 'credito' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Abono inicial $</label>
                  <input
                    value={s.ncAbono || ''}
                    onChange={(e) => s.setNcAbono(num(e.target.value))}
                    inputMode="numeric"
                    placeholder="0"
                    style={{ flex: 1, height: 40, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                <div style={{ marginBottom: 12, fontSize: 12.5, color: '#8A6B2E', background: '#FDF4E5', borderRadius: 9, padding: '9px 12px' }}>
                  El saldo restante quedará como crédito a nombre del proveedor.
                </div>
              </>
            )}
            <button
              onClick={() => {
                if (s.ncItems.length) s.holdPurchase()
                else s.go('compras')
              }}
              style={{ width: '100%', height: 44, borderRadius: 11, background: '#FDF4E5', color: '#B4740A', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12">
                <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
                <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
              </svg>
              {(s.ncItems.length ? 'Poner en espera' : 'Ver esperas') + (s.heldPurchases.length ? ' · ' + s.heldPurchases.length : '')}
            </button>
            <button
              onClick={() => {
                if (canSave) s.saveNuevaCompra()
              }}
              className={canSave ? 'v-hover-primary' : undefined}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 15.5,
                color: '#fff',
                cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave ? '#6366F1' : '#C7CDEC',
                boxShadow: canSave ? '0 8px 18px -8px #6366F1cc' : undefined,
              }}
            >
              Guardar compra
            </button>
          </div>
        </aside>
      </div>

      {/* Editor de línea */}
      {edit && (
        <div
          onClick={() => setEdit(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{edit.name}</h2>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{edit.sku}</div>
              </div>
              <button
                onClick={() => setEdit(null)}
                className="v-hover-bg"
                style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg)', color: '#5A616E', fontSize: 17, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...editLabelStyle, margin: '11px 0 5px' }}>
                  {isKg(edit.productId) ? 'Cantidad recibida (kg)' : 'Cantidad recibida'}
                </label>
                <input
                  key={edit.productId}
                  defaultValue={edit.qty || ''}
                  onChange={(e) => {
                    const qty = isKg(edit.productId) ? parseQty(e.target.value) : num(e.target.value)
                    setEdit({ ...edit, qty, total: Math.round(qty * (edit.unit || 0)) })
                  }}
                  inputMode={isKg(edit.productId) ? 'decimal' : 'numeric'}
                  placeholder={isKg(edit.productId) ? '0,000' : '0'}
                  style={editInputStyle}
                />
              </div>
              <div>
                <label style={{ ...editLabelStyle, margin: '11px 0 5px' }}>Costo por unidad $</label>
                <input
                  value={edit.unit || ''}
                  onChange={(e) => {
                    const unit = num(e.target.value)
                    setEdit({ ...edit, unit, total: (edit.qty || 0) * unit, price: priceFromMargin(unit, edit.pct || 0) })
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  style={editInputStyle}
                />
              </div>
            </div>
            <label style={editLabelStyle}>Costo total $</label>
            <input
              value={edit.total || ''}
              onChange={(e) => {
                const total = num(e.target.value)
                const unit = (edit.qty || 0) > 0 ? Math.round(total / edit.qty) : 0
                setEdit({ ...edit, total, unit, price: priceFromMargin(unit, edit.pct || 0) })
              }}
              inputMode="numeric"
              placeholder="0"
              style={editInputStyle}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={editLabelStyle}>% de ganancia</label>
                <input
                  value={edit.pct || ''}
                  onChange={(e) => {
                    const pct = num(e.target.value)
                    setEdit({ ...edit, pct, price: priceFromMargin(edit.unit || 0, pct) })
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  style={editInputStyle}
                />
              </div>
              <div>
                <label style={editLabelStyle}>Precio de venta $</label>
                <input
                  value={edit.price || ''}
                  onChange={(e) => {
                    const price = num(e.target.value)
                    setEdit({ ...edit, price, pct: marginFromPrice(edit.unit || 0, price) })
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  style={editInputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: 12, background: 'var(--bg)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: 'var(--muted)' }}>
              Los campos se recalculan entre sí: cambia el costo, el % de ganancia o el precio de venta y los demás se ajustan.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setEdit(null)}
                className="v-hover-bg"
                style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button onClick={addItem} style={saveBtnStyle(edit.qty > 0 && edit.unit > 0)}>
                Agregar a la compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
