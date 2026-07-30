'use client'

// Panel Principal — réplica 1:1 del prototipo (sección sPanel):
// tarjetas de estadísticas, donut por método, línea 7 días, últimas ventas y top productos.

import { useApp } from '../store'
import { tileFor, methodLabel } from '../ui'

export default function PanelScreen() {
  const s = useApp()

  const activeSales = s.sales.filter((v) => v.status === 'COMPLETED')
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const todaySales = activeSales.filter((v) => new Date(v.createdAt).getTime() >= startOfDay)
  const salesTotal = todaySales.reduce((a, v) => a + v.total, 0)

  // Donut por método de pago (con desglose del cobro combinado)
  const mAgg: Record<string, number> = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, 'Crédito': 0 }
  for (const v of todaySales) {
    if (v.payments?.length) {
      for (const p of v.payments) {
        const k = methodLabel(p.method)
        if (mAgg[k] !== undefined) mAgg[k] += p.amount
      }
    } else {
      const k = methodLabel(v.paymentMethod).split(' + ')[0]
      if (mAgg[k] !== undefined) mAgg[k] += v.total
    }
  }
  const mSum = Object.values(mAgg).reduce((a, b) => a + b, 0)
  const donut: Array<[string, number, string]> =
    mSum > 0
      ? [
          ['Efectivo', mAgg.Efectivo, '#10B981'],
          ['Tarjeta', mAgg.Tarjeta, '#6366F1'],
          ['Transferencia', mAgg.Transferencia + mAgg['Crédito'], '#A7F3D0'],
        ]
      : [
          ['Efectivo', 60, '#10B981'],
          ['Tarjeta', 30, '#6366F1'],
          ['Transferencia', 10, '#A7F3D0'],
        ]
  const dSum = donut.reduce((a, d) => a + d[1], 0) || 1
  let acc = 0
  const stops: string[] = []
  const legend = donut.map(([label, val, color]) => {
    const pct = Math.round((val / dSum) * 100)
    const from = (acc / dSum) * 100
    const to = ((acc + val) / dSum) * 100
    acc += val
    stops.push(`${color} ${from.toFixed(1)}% ${to.toFixed(1)}%`)
    return { label, pct, color }
  })
  const donutBg = `conic-gradient(${stops.join(',')})`

  // Línea de los últimos 7 días con datos reales
  const daySeries: Array<{ label: string; total: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const from = d.getTime()
    const to = from + 86400000
    const label = i === 0 ? 'Hoy' : d.toLocaleDateString('es-CO', { weekday: 'short' })
    daySeries.push({
      label: label.charAt(0).toUpperCase() + label.slice(1).replace('.', ''),
      total: activeSales
        .filter((v) => {
          const t = new Date(v.createdAt).getTime()
          return t >= from && t < to
        })
        .reduce((a, v) => a + v.total, 0),
    })
  }
  const dMax = Math.max(...daySeries.map((d) => d.total), 1) * 1.12
  const LW = 100
  const LH = 42
  const lpts = daySeries.map((d, i) => {
    const x = (i / (daySeries.length - 1)) * LW
    const y = LH - (d.total / dMax) * LH
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const linePoints = lpts.join(' ')
  const areaPath = `M0,${LH} L${lpts.join(' L')} L${LW},${LH} Z`
  const peak = Math.max(...daySeries.map((d) => d.total))

  // Top productos vendidos (hoy)
  const tAgg = new Map<string, { name: string; qty: number; imageUrl?: string | null }>()
  for (const v of todaySales) {
    for (const it of v.items) {
      const e = tAgg.get(it.productId) ?? { name: it.product.name, qty: 0 }
      tAgg.set(it.productId, { ...e, qty: e.qty + it.quantity })
    }
  }
  let topList = Array.from(tAgg.entries())
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
  if (!topList.length) {
    topList = s.products.slice(0, 5).map((p, i) => ({ id: p.id, name: p.name, qty: [45, 32, 28, 22, 18][i] ?? 10, imageUrl: p.imageUrl }))
  }

  const lastSales = todaySales.slice(0, 5)
  const activeProds = s.products.length

  const stats = [
    { label: 'Ventas de hoy', value: s.fmt(salesTotal), tileBg: '#EEF0FE', tileFg: '#6366F1', onClick: () => s.go('ventas') },
    { label: 'Transacciones', value: String(todaySales.length), tileBg: '#D1FAE5', tileFg: '#10B981', onClick: () => s.go('ventas') },
    { label: 'Productos activos', value: String(activeProds), tileBg: '#F2EEFB', tileFg: '#7B4FD4', onClick: () => s.go('productos') },
    { label: 'Clientes', value: String(s.customers.length), tileBg: '#FCEEF3', tileFg: '#C74B7E', onClick: () => s.go('clientes') },
  ]

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: '0 1px 2px rgba(15,23,42,.03),0 10px 26px -20px rgba(15,23,42,.14)',
    padding: 20,
  }

  // Productos por agotarse: en o por debajo del mínimo (o agotados)
  const lowStock = s.products.filter(
    (p) => p.status === 'ACTIVE' && (p.stock <= 0 || (p.minStock > 0 && p.stock <= p.minStock)),
  )

  return (
    <div style={{ padding: 'clamp(16px,3vw,30px)', display: 'flex', flexDirection: 'column', gap: 18, animation: 'vfade .3s ease' }}>
      {lowStock.length > 0 && (
        <button
          onClick={() => s.go('productos')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#FDF4E5', border: '1.5px solid #F3DCB0', borderRadius: 14, padding: '12px 18px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 13.5, color: '#8A6B2E', lineHeight: 1.5 }}>
            <b>
              {lowStock.length} producto{lowStock.length === 1 ? '' : 's'} con stock bajo:
            </b>{' '}
            {lowStock
              .slice(0, 4)
              .map((p) => `${p.name} (${p.stock <= 0 ? 'agotado' : p.stock + (p.unitOfMeasure === 'kg' ? ' kg' : '')})`)
              .join(', ')}
            {lowStock.length > 4 ? ` y ${lowStock.length - 4} más` : ''}
          </span>
          <span style={{ color: '#B4740A', fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap' }}>Ver →</span>
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.6px' }}>Panel Principal</h1>
          <div style={{ color: 'var(--muted)', fontSize: 14.5, marginTop: 4 }}>
            ¡Hola {s.me.name}! Aquí tienes el resumen de tu negocio.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => s.openModal('contact')}
            className="v-hover-border"
            style={{ height: 46, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontWeight: 600, fontSize: 14, color: 'var(--text)', cursor: 'pointer', transition: 'all .13s' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7z" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3 5l5 3.5L13 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Contáctanos
          </button>
          <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ background: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)', borderRadius: 14, padding: '10px 22px', textAlign: 'right', boxShadow: '0 14px 26px -12px rgba(99,102,241,.6)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.85)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Ventas de hoy</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px', marginTop: 1 }}>
              {s.fmt(salesTotal)}{' '}
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', fontWeight: 500 }}>
                · {todaySales.length} {todaySales.length === 1 ? 'venta' : 'ventas'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: 14 }}>
        {stats.map((st) => (
          <button
            key={st.label}
            onClick={st.onClick}
            className="v-hover-lift"
            style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 1px 2px rgba(15,23,42,.03),0 10px 26px -20px rgba(15,23,42,.14)', padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all .13s' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 11, background: st.tileBg, color: st.tileFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 16 16" fill="none">
                <path d="M2 11l3.5-3.5 2.5 2.5L14 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 4h4v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{st.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.6px', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{st.value}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Ventas por método de pago</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ width: 150, height: 150, borderRadius: '50%', background: donutBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <div style={{ width: 98, height: 98, borderRadius: '50%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(salesTotal)}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Total</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 13 }}>
              {legend.map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color, flex: 'none' }} />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{l.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{l.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Ventas en los últimos 7 días</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(peak)}</div>
          </div>
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" style={{ width: '100%', height: 150, display: 'block' }}>
            <defs>
              <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#6366F1" stopOpacity=".22" />
                <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#dashArea)" />
            <polyline points={linePoints} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {daySeries.map((d, i) => (
              <span key={i} style={{ fontSize: 11.5, color: '#94A3B8' }}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Últimas ventas</div>
            <button onClick={() => s.go('ventas')} className="v-hover-underline" style={{ fontSize: 13, color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
              Ver todas
            </button>
          </div>
          {lastSales.length ? (
            lastSales.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  s.setSaleDetId(v.id)
                  s.openModal('ventaDetalle')
                }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #EEF2F7', cursor: 'pointer', textAlign: 'left', background: 'none' }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: '#6366F1', minWidth: 78 }}>{v.folio}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.customer?.name?.trim() || 'Sin cliente'}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(v.total)}</span>
              </button>
            ))
          ) : (
            <div style={{ padding: '18px 0', color: 'var(--muted)', fontSize: 14 }}>Aún no hay ventas hoy.</div>
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Productos más vendidos</div>
            <button onClick={() => s.go('productos')} className="v-hover-underline" style={{ fontSize: 13, color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
              Ver todos
            </button>
          </div>
          {topList.map((p, i) => {
            const t = tileFor({ id: p.id, name: p.name, imageUrl: p.imageUrl })
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #EEF2F7' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', width: 16 }}>{i + 1}</span>
                <div style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: t.tileFg, ...t.tileStyle }}>
                  {t.tileText}
                </div>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{p.qty}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ background: '#0F172A', borderRadius: 18, padding: '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-.3px' }}>Tu negocio, bajo control.</div>
          <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>Ventory te acompaña en cada venta, compra y decisión.</div>
        </div>
        <button
          onClick={() => s.go('reportes')}
          style={{ position: 'relative', zIndex: 1, height: 44, padding: '0 22px', borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#6366F1)', color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 10px 24px -10px rgba(99,102,241,.7)', whiteSpace: 'nowrap' }}
        >
          Explorar reportes
        </button>
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" style={{ position: 'absolute', right: 0, bottom: 0, width: '56%', height: '100%', opacity: 0.5 }}>
          <polyline points="0,50 25,40 50,44 75,28 100,33 125,18 150,24 175,10 200,15" fill="none" stroke="#10B981" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  )
}
