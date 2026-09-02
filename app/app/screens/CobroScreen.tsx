'use client'

// Pantalla de cobro — réplica 1:1 del prototipo (sección sCobro).
// Cobro combinado: Efectivo/Tarjeta/Transferencia con montos; Crédito exclusivo.

import { CSSProperties } from 'react'
import { useApp } from '../store'
import { DENOMS, DENOM_LABELS } from '../ui'
import { useWindowWidth } from '../Shell'
import CampoNumerico from '../modals/CampoNumerico'

export default function CobroScreen() {
  const s = useApp()
  const w = useWindowWidth()

  const p = s.pay
  const total = s.total

  const nonCashSel = (['tarjeta', 'transferencia'] as const).filter((k) => p[k])
  const activeCount = (p.efectivo ? 1 : 0) + nonCashSel.length
  const singleSimple = !p.credito && !p.efectivo && activeCount === 1
  const showSplit = !p.credito && activeCount > 1
  const nonCashSum = singleSimple ? total : nonCashSel.reduce((a, k) => a + (s.amounts[k] || 0), 0)
  const cashDue = p.efectivo ? Math.max(0, total - nonCashSum) : 0
  const restante = Math.max(0, total - nonCashSum)

  const covered = p.credito ? true : nonCashSum + (p.efectivo ? s.received || 0 : 0) >= total
  const canFinalize = s.cart.length > 0 && covered
  const change = p.efectivo ? Math.max(0, (s.received || 0) - cashDue) : 0
  const changeOk = p.efectivo && cashDue > 0 && (s.received || 0) >= cashDue

  const methodDefs = [
    { key: 'efectivo' as const, label: 'Efectivo', tag: 'Contado', color: '#6366F1' },
    { key: 'tarjeta' as const, label: 'Tarjeta', tag: 'Débito/Créd.', color: '#6366F1' },
    { key: 'transferencia' as const, label: 'Transf.', tag: 'Bancaria', color: '#6366F1' },
    { key: 'credito' as const, label: 'Crédito', tag: 'A cuenta', color: '#D9820E' },
  ]

  const methodStyle = (active: boolean, color: string): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '14px 8px',
    borderRadius: 13,
    cursor: 'pointer',
    transition: 'all .13s',
    border: `1.5px solid ${active ? color : '#E6E8EF'}`,
    background: active ? color : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
    boxShadow: active ? `0 8px 18px -8px ${color}cc` : undefined,
  })

  const denomBase: CSSProperties = { height: 56, borderRadius: 12, background: '#EEF2F7', color: '#2A303B', fontWeight: 700, fontSize: 16, cursor: 'pointer', transition: 'background .12s' }

  const creditCustomer = s.customerName.trim()
  const showItemsCol = w >= 900 && s.cart.length > 0

  const onFinalize = () => {
    if (!canFinalize) return
    if (p.credito) {
      // Crédito requiere elegir cliente registrado (modal del prototipo)
      s.openModal('creditoVenta')
    } else {
      s.finalizeSale()
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ height: 56, flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 clamp(14px,3vw,24px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={() => s.go('pos')} style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#5A616E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          ← Volver
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16, letterSpacing: '-.2px' }}>Cobro</div>
        <div style={{ width: 70 }} />
      </header>

      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 520px', minWidth: 'min(100%,320px)', padding: 'clamp(16px,3vw,30px) clamp(14px,3vw,30px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Total a cobrar</div>
            <div style={{ fontSize: 'clamp(38px,7vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(total)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            {methodDefs.map((d) => {
              const active = p[d.key]
              return (
                <button key={d.key} onClick={() => s.togglePayMethod(d.key)} style={methodStyle(active, d.color)}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'rgba(255,255,255,.8)' : '#9AA1AE' }}>{d.tag}</span>
                  <span style={{ fontSize: 15.5, fontWeight: 700 }}>{d.label}</span>
                </button>
              )
            })}
          </div>

          {showSplit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {nonCashSel.map((k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '6px 6px 6px 16px' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap' }}>{k === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</span>
                  <CampoNumerico
                    value={s.amounts[k] || ''}
                    onChange={(raw) => s.setAmount(k, parseInt(raw.replace(/\D/g, '')) || 0)}
                    titulo={k === 'tarjeta' ? 'Monto con tarjeta' : 'Monto por transferencia'}
                    style={{ flex: 1, minWidth: 80, height: 42, border: 'none', background: 'var(--bg)', borderRadius: 9, textAlign: 'right', padding: '0 14px', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
              ))}
              {p.efectivo ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EEF2F7', borderRadius: 11, padding: '12px 16px', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Restante en efectivo</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#2A303B' }}>{s.fmt(cashDue)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: restante === 0 ? '#EEF0FE' : '#FDF4E5', borderRadius: 11, padding: '12px 16px', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Restante por cubrir</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: restante === 0 ? '#6366F1' : '#B4740A' }}>{s.fmt(restante)}</span>
                </div>
              )}
            </div>
          )}

          {p.efectivo && !p.credito && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: '1 1 260px', background: '#0F172A', borderRadius: 14, padding: '15px 18px' }}>
                  <div style={{ fontSize: 12.5, color: '#7EA6A0', fontWeight: 600 }}>Efectivo recibido</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px', marginTop: 2 }}>
                    {s.received > 0 ? s.fmt(s.received) : '$ —'}
                  </div>
                </div>
                <div style={{ flex: '1 1 260px', background: changeOk ? '#EEF0FE' : 'var(--surface2)', border: `1.5px solid ${changeOk ? '#C7D0FB' : '#EEF2F7'}`, borderRadius: 14, padding: '15px 18px' }}>
                  <div style={{ fontSize: 12.5, color: changeOk ? '#5FA89E' : '#B4BAC5', fontWeight: 600 }}>Cambio</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: changeOk ? '#6366F1' : '#B4BAC5', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px', marginTop: 2 }}>
                    {changeOk ? s.fmt(change) : '$ —'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
                {DENOMS.map((v, idx) => (
                  <button key={v} onClick={() => s.addReceived(v)} className="v-hover-denom" style={denomBase}>
                    {DENOM_LABELS[idx]}
                  </button>
                ))}
                <button onClick={() => s.setReceived(cashDue)} style={{ height: 56, borderRadius: 12, background: '#EEF0FE', color: '#6366F1', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                  Exacto
                </button>
                <button onClick={() => s.setReceived(0)} style={{ height: 56, borderRadius: 12, background: '#FDECEC', color: '#C9433B', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  ⌫ Limpiar
                </button>
              </div>
            </div>
          )}

          {singleSimple && (
            <div style={{ background: '#EEF0FE', border: '1.5px solid #BFE5DF', borderRadius: 14, padding: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#4338CA' }}>{p.tarjeta ? 'Pago con tarjeta' : 'Pago por transferencia'}</div>
                <div style={{ fontSize: 13.5, color: '#5A616E', marginTop: 3 }}>
                  {p.tarjeta ? 'Pasa la tarjeta en el datáfono por el total.' : 'El cliente transfiere el total a la cuenta.'}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#4338CA', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(total)}</div>
            </div>
          )}

          {p.credito && (
            <div style={{ background: '#FDF4E5', border: '1.5px solid #F3DCB0', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#B4740A' }}>Pago a crédito</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#B4740A', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(total)}</div>
              </div>
              <div style={{ fontSize: 13.5, color: '#8A6B2E', margin: '6px 0 14px' }}>El valor se agregará a la cuenta del cliente.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FCEBCB', borderRadius: 11, padding: '12px 14px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F1D28C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#8A6B2E' }}>
                  {(creditCustomer || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, fontWeight: 700, color: '#7A5E1F' }}>
                  {creditCustomer || 'Elige el cliente al finalizar'}
                </div>
              </div>
            </div>
          )}

          <input
            value={s.customerName}
            onChange={(e) => s.setCustomerName(e.target.value)}
            placeholder="Buscar o crear cliente (opcional)…"
            list="cobro-customers"
            style={{ width: '100%', height: 46, padding: '0 15px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontSize: 14.5 }}
          />
          <datalist id="cobro-customers">
            {s.customers.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <input
            value={s.note}
            onChange={(e) => s.setNote(e.target.value)}
            placeholder="Notas opcionales…"
            style={{ width: '100%', height: 46, padding: '0 15px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontSize: 14.5 }}
          />
        </div>

        {showItemsCol && (
          <aside style={{ flex: '0 1 340px', minWidth: 300, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid #EEF2F7' }}>
              Artículos
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px' }}>
              {s.cart.map((it) => (
                <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: '1px solid #EEF2F7' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>{it.qty}×</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {s.fmt(Math.round(it.price * it.qty * (1 - (it.dscPct || 0) / 100)))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #EEF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--input)' }}>
              <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                {s.itemCount} {s.itemCount === 1 ? 'art.' : 'arts.'}
              </span>
              <span style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(total)}</span>
            </div>
          </aside>
        )}
      </div>

      <div style={{ flex: 'none', padding: '14px clamp(14px,3vw,30px) 18px', background: 'var(--bg)', position: 'sticky', bottom: 0 }}>
        <button
          onClick={onFinalize}
          style={{ width: '100%', height: 58, borderRadius: 15, background: canFinalize ? '#6366F1' : '#9CCFC7', color: '#fff', fontWeight: 800, fontSize: 17.5, cursor: canFinalize ? 'pointer' : 'not-allowed', boxShadow: '0 12px 26px -12px rgba(16,152,135,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          ✓ Finalizar venta <span style={{ fontVariantNumeric: 'tabular-nums' }}>· {s.fmt(total)}</span>
        </button>
      </div>
    </div>
  )
}
