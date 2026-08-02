'use client'

// Punto de venta — réplica 1:1 del prototipo (sección sPos).
// En pantallas angostas (<880px) el carrito se vuelve un panel deslizante con
// barra inferior fija (total + Cobrar siempre visibles), estilo app móvil.

import { useState } from 'react'
import { useApp } from '../store'
import { tileFor, VLogo, fmtQty } from '../ui'
import { Icono } from '@/components/Icono'
import { BotonPantallaCompleta } from '../Pantalla'
import { useWindowWidth } from '../Shell'

function CartItems() {
  const s = useApp()
  return (
    <>
      {s.cart.map((it) => {
        const t = tileFor({ id: it.productId, name: it.name, imageUrl: it.imageUrl })
        const lineVal = Math.round(it.price * it.qty * (1 - (it.dscPct || 0) / 100))
        return (
          <div key={it.productId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0', borderBottom: '1px solid #EEF2F7' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, overflow: 'hidden', color: t.tileFg, ...t.tileStyle }}>
              {t.tileText}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{it.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>{s.fmt(it.price)} c/u</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
              <button onClick={() => s.changeQty(it.productId, -1)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                −
              </button>
              <span
                onClick={it.unit === 'kg' ? () => s.editPeso(it.productId) : undefined}
                title={it.unit === 'kg' ? 'Toca para digitar el peso' : undefined}
                style={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: it.unit === 'kg' ? 12.5 : 14, cursor: it.unit === 'kg' ? 'pointer' : undefined, color: it.unit === 'kg' ? '#6366F1' : undefined, whiteSpace: 'nowrap' }}
              >
                {it.unit === 'kg' ? `${fmtQty(it.qty)} kg` : it.qty}
              </span>
              <button onClick={() => s.changeQty(it.productId, 1)} style={{ width: 30, height: 30, borderRadius: 8, background: '#EEF0FE', color: '#6366F1', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                +
              </button>
            </div>
            <button
              onClick={() => {
                s.setDscId(it.productId)
                s.openModal('itemDsc')
              }}
              title="Descuento del artículo"
              style={{ textAlign: 'right', cursor: 'pointer', flex: 'none', padding: 0, background: 'none' }}
            >
              <div style={{ fontWeight: 800, fontSize: 13.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{s.fmt(lineVal)}</div>
              {it.dscPct > 0 && <div style={{ fontSize: 11, color: '#D9820E', fontWeight: 700 }}>−{it.dscPct}%</div>}
            </button>
          </div>
        )
      })}
    </>
  )
}

// Totales + descuento + cliente + acciones (compartido entre escritorio y móvil)
function CartFooter({ onAction }: { onAction?: () => void }) {
  const s = useApp()
  const ivaPct = s.settings?.ivaPct ?? 0
  const ivaStr = s.fmt(ivaPct > 0 ? Math.round((s.total * ivaPct) / (100 + ivaPct)) : 0)
  const esperaLabel = 'Espera' + (s.heldSales.length ? ` · ${s.heldSales.length}` : '')

  return (
    <div style={{ flex: 'none', borderTop: '1px solid #EEF2F7', padding: '16px 20px', background: 'var(--input)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
        <span>Subtotal</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.subtotal)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
        <span>IVA incluido</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{ivaStr}</span>
      </div>
      {s.discount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6366F1', marginBottom: 8 }}>
          <span>Descuento</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            − {s.fmt(s.discountIsPct ? Math.round((s.subtotal * s.discount) / 100) : s.discount)}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 2, borderTop: '1px dashed #E2E5EC' }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Total</span>
        <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.5px', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.total)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 12px' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Descuento</label>
        <button
          onClick={() => s.setDiscountIsPct(false)}
          style={{ width: 32, height: 32, borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer', background: !s.discountIsPct ? '#6366F1' : 'var(--bg)', color: !s.discountIsPct ? '#fff' : 'var(--muted)' }}
        >
          $
        </button>
        <button
          onClick={() => s.setDiscountIsPct(true)}
          style={{ width: 32, height: 32, borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer', background: s.discountIsPct ? '#6366F1' : 'var(--bg)', color: s.discountIsPct ? '#fff' : 'var(--muted)' }}
        >
          %
        </button>
        <input
          value={s.discount || ''}
          onChange={(e) => {
            let v = parseInt((e.target.value || '').replace(/\D/g, '')) || 0
            if (s.discountIsPct) v = Math.min(100, v)
            s.setDiscount(v)
          }}
          inputMode="numeric"
          placeholder="0"
          style={{ flex: 1, height: 40, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Cliente</label>
        <input
          value={s.customerName}
          onChange={(e) => s.setCustomerName(e.target.value)}
          placeholder="Opcional"
          list="pos-customers"
          style={{ flex: 1, height: 40, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 14, minWidth: 0 }}
        />
        <datalist id="pos-customers">
          {s.customers.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => {
            if (s.cart.length) {
              s.holdSale()
              onAction?.()
            } else {
              onAction?.()
              s.go('esperas')
            }
          }}
          style={{ flex: 1, height: 44, borderRadius: 11, background: '#FDF4E5', color: '#B4740A', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12">
            <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
            <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
          </svg>
          {esperaLabel}
        </button>
        <button
          onClick={() => s.cart.length && s.openModal('creditoVenta')}
          style={{ flex: 1, height: 44, borderRadius: 11, fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .13s', background: s.cart.length ? '#FDF1E7' : 'var(--bg)', color: s.cart.length ? '#D9820E' : '#B4BAC5', cursor: s.cart.length ? 'pointer' : 'not-allowed' }}
        >
          Crédito
        </button>
        <button
          onClick={() => {
            onAction?.()
            s.go('devoluciones')
          }}
          style={{ flex: 1, height: 44, borderRadius: 11, background: '#F2EEFB', color: '#7B4FD4', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', transition: 'all .13s' }}
        >
          Devolución
        </button>
      </div>
      <button
        onClick={() => s.cart.length > 0 && s.go('cobro')}
        disabled={s.cart.length === 0}
        style={{ width: '100%', height: 52, borderRadius: 13, background: s.cart.length === 0 ? '#C7CDEC' : '#6366F1', color: '#fff', fontWeight: 800, fontSize: 16, cursor: s.cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: s.cart.length === 0 ? 'none' : '0 12px 24px -12px #6366F1cc', transition: 'background .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}
      >
        Cobrar<span style={{ opacity: 0.7, fontWeight: 600 }}>·</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{s.fmt(s.total)}</span>
      </button>
    </div>
  )
}

export default function PosScreen() {
  const s = useApp()
  const w = useWindowWidth()
  const narrow = w < 880
  const [query, setQuery] = useState('')
  const [cartOpen, setCartOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const results = s.products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q),
  )

  // Lector de código de barras USB: el lector "escribe" el código y envía Enter.
  // Enter agrega directo al carrito por código/SKU exacto (o si hay un único resultado).
  const onSearchEnter = () => {
    const code = query.trim()
    if (!code) return
    const exact = s.products.find(
      (p) => p.barcode === code || (p.sku ?? '').toLowerCase() === code.toLowerCase(),
    )
    const target = exact ?? (results.length === 1 ? results[0] : undefined)
    if (target) {
      s.addToCart(target)
      setQuery('')
    } else {
      s.toast(`Sin coincidencia exacta para "${code}"`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: 'var(--text)', background: 'var(--bg)' }}>
      <header
        data-no-print="true"
        style={{ height: 60, flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: narrow ? 10 : 14, padding: '0 clamp(14px,3vw,26px)', position: 'sticky', top: 0, zIndex: 20 }}
      >
        <button onClick={() => s.go('panel')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7A8091', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 'none' }}>
          ← {narrow ? '' : 'Inicio'}
        </button>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#EEF0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <VLogo size={18} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>
            Ventory <span style={{ color: 'var(--muted)', fontWeight: 600 }}>POS</span>
          </div>
          {!narrow && (
            <span style={{ color: 'var(--muted)', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              · {s.settings?.name}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 10 : 16, flex: 'none' }}>
          {!narrow && (
            <>
              <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Caja</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#6366F1', whiteSpace: 'nowrap' }}>
                  {s.cash.session?.branch.name ?? 'Sin turno abierto'}
                </div>
              </div>
              <div style={{ width: 1, height: 26, background: 'var(--border)' }} />
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', fontWeight: 700, fontSize: 14 }}>
              {(s.me.name || '?')[0].toUpperCase()}
            </div>
            {!narrow && (
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Cajero</div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.me.name}</div>
              </div>
            )}
          </div>
          <BotonPantallaCompleta />
          <button
            onClick={() => s.go('cierre')}
            title="Cerrar caja"
            style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="2" fill="#5A616E" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="#5A616E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <main style={{ flex: '1 1 460px', minWidth: 'min(100%,340px)', padding: 'clamp(14px,2.4vw,24px)', paddingBottom: narrow ? 96 : undefined, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, maxWidth: '100%' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearchEnter()
              }}
              placeholder="Buscar por nombre, SKU o código de barras…"
              autoFocus={!narrow}
              // minWidth: 0 permite que el campo se encoja junto al botón de
              // cámara; sin esto la fila desborda la pantalla del celular
              style={{ flex: 1, minWidth: 0, height: 52, padding: '0 18px', border: '1.5px solid var(--border)', borderRadius: 14, background: 'var(--surface)', fontSize: 15.5, boxShadow: '0 1px 2px rgba(16,20,30,.04)' }}
            />
            <button
              onClick={() => s.openModal('scanner')}
              title="Escanear con la cámara"
              aria-label="Escanear con la cámara"
              style={{ width: 52, height: 52, flex: 'none', borderRadius: 14, background: '#EEF0FE', color: '#4338CA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icono n="codigo" tam={22} />
            </button>
          </div>

          {results.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${narrow ? 140 : 158}px,1fr))`, gap: 12, alignContent: 'start' }}>
              {results.map((p) => {
                const inCart = s.cart.find((i) => i.productId === p.id)
                const t = tileFor(p)
                return (
                  <button
                    key={p.id}
                    onClick={() => s.addToCart(p)}
                    className="v-hover-lift"
                    style={{ textAlign: 'left', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 9, transition: 'all .13s', position: 'relative', overflow: 'hidden' }}
                  >
                    <div style={{ height: narrow ? 64 : 82, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...t.tileStyle }}>
                      <span style={{ fontWeight: 800, fontSize: 20, color: t.tileFg, letterSpacing: '.5px' }}>{t.tileText}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.28, minHeight: 35 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 5, gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{s.fmt(p.price)}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{p.sku}</span>
                      </div>
                    </div>
                    {inCart && (
                      <div style={{ position: 'absolute', top: 8, right: 8, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {inCart.qty}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#AEB4C0', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted)' }}>
                Sin resultados para {'"'}
                {query}
                {'"'}
              </div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Prueba otro nombre, SKU o código de barras</div>
            </div>
          )}
        </main>

        {!narrow && (
          <aside style={{ flex: '0 1 380px', minWidth: 'min(100%,320px)', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 60, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 60px)' }}>
            <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EEF2F7', flex: 'none' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Carrito</h2>
              {s.cart.length > 0 && (
                <button onClick={s.clearCart} className="v-hover-underline" style={{ fontSize: 13, color: '#C9433B', fontWeight: 600, cursor: 'pointer' }}>
                  Vaciar · {s.itemCount} {s.itemCount === 1 ? 'art.' : 'arts.'}
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 20px', minHeight: 120 }}>
              {s.cart.length > 0 ? (
                <CartItems />
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 20px', color: '#B4BAC5', textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--muted)' }}>El carrito está vacío</div>
                  <div style={{ fontSize: 13.5, marginTop: 3 }}>Toca un producto para agregarlo</div>
                </div>
              )}
            </div>

            <CartFooter />
          </aside>
        )}
      </div>

      {/* Móvil: barra inferior fija con total + Carrito + Cobrar */}
      {narrow && (
        <div
          data-no-print="true"
          style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -10px 30px -18px rgba(15,23,42,.35)', padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <button
            onClick={() => setCartOpen(true)}
            style={{ flex: 1, height: 50, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' }}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <path d="M2 2.5h2l1.6 8.2a1 1 0 0 0 1 .8h5.6a1 1 0 0 0 1-.8L14.5 5H4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6.8" cy="13.6" r="1.1" fill="currentColor" />
              <circle cx="12" cy="13.6" r="1.1" fill="currentColor" />
            </svg>
            Carrito
            {s.itemCount > 0 && (
              <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.itemCount}
              </span>
            )}
          </button>
          <button
            onClick={() => s.cart.length > 0 && s.go('cobro')}
            disabled={s.cart.length === 0}
            style={{ flex: 1.4, height: 50, borderRadius: 12, background: s.cart.length === 0 ? '#C7CDEC' : '#6366F1', color: '#fff', fontWeight: 800, fontSize: 15.5, cursor: s.cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: s.cart.length === 0 ? 'none' : '0 10px 22px -10px #6366F1cc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, whiteSpace: 'nowrap' }}
          >
            Cobrar · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.total)}</span>
          </button>
        </div>
      )}

      {/* Móvil: panel deslizante del carrito */}
      {narrow && cartOpen && (
        <div
          data-no-print="true"
          onClick={() => setCartOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 90, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxHeight: '88vh', background: 'var(--surface)', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', animation: 'vfade .2s ease', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EEF2F7', flex: 'none' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Carrito</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {s.cart.length > 0 && (
                  <button onClick={s.clearCart} style={{ fontSize: 13, color: '#C9433B', fontWeight: 600, cursor: 'pointer' }}>
                    Vaciar · {s.itemCount} {s.itemCount === 1 ? 'art.' : 'arts.'}
                  </button>
                )}
                <button
                  onClick={() => setCartOpen(false)}
                  style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg)', color: 'var(--muted)', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 20px', minHeight: 80 }}>
              {s.cart.length > 0 ? (
                <CartItems />
              ) : (
                <div style={{ padding: '36px 20px', color: '#B4BAC5', textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--muted)' }}>El carrito está vacío</div>
                  <div style={{ fontSize: 13.5, marginTop: 3 }}>Toca un producto para agregarlo</div>
                </div>
              )}
            </div>
            <CartFooter onAction={() => setCartOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
