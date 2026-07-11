'use client'

// Reporte Diario — réplica 1:1 de la pantalla sReportes del prototipo
// (docs/prototype/Ventory POS.dc.html): tarjetas de estadísticas, ventas por
// hora, por método de pago, top 5 productos, utilidad, resumen de caja y
// el historial de turnos cerrados.

import { CSSProperties, useEffect, useState } from 'react'
import { useApp } from '../store'
import { methodLabel, methodTint } from '../ui'

const cardShell: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
  padding: 20,
}

const cardTitle: CSSProperties = { fontWeight: 800, fontSize: 16, marginBottom: 14 }

const STAT_TINTS: Array<[string, string]> = [
  ['#EEF0FE', '#4338CA'],
  ['#F2EEFB', '#7B4FD4'],
  ['#FDF1E7', '#B4740A'],
  ['#E9F4F8', '#2E8CB0'],
  ['#FCEEF3', '#C74B7E'],
  ['#EEF2F7', '#4B515E'],
]

function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function EmptyDay() {
  return <div style={{ padding: '34px 0', textAlign: 'center', color: '#B4BAC5', fontSize: 14 }}>Sin ventas en esta fecha</div>
}

export default function ReportesScreen() {
  const s = useApp()
  const [date, setDate] = useState(todayStr)

  useEffect(() => {
    s.loadReport(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const r = s.report
  const nSales = r?.summary.transactionCount ?? 0
  const hasSales = nSales > 0

  const statCards = [
    { label: 'Total ventas', value: s.fmt(r?.summary.totalSales ?? 0) },
    { label: 'Transacciones', value: String(nSales) },
    { label: 'Apertura caja', value: s.fmt(s.apertura) },
    { label: 'Saldo esperado', value: s.fmt(s.esperado) },
    { label: 'Venta promedio', value: nSales ? s.fmt(r?.summary.averageSale ?? 0) : '$ 0' },
    { label: 'Arts. por venta', value: nSales ? (r?.summary.itemsPerSale ?? 0).toFixed(1).replace('.', ',') : '0' },
  ]

  const hoursWithSales = (r?.salesByHour ?? []).filter((h) => h.total > 0).sort((a, b) => a.hour - b.hour)
  const maxHour = Math.max(1, ...hoursWithSales.map((h) => h.total))

  const methodEntries = Object.entries(r?.byPaymentMethod ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const maxMethod = Math.max(1, ...methodEntries.map(([, v]) => v))

  const topRows = (r?.topProducts ?? []).slice(0, 5)

  const profit = r?.profit
  const margen = profit && profit.sales > 0 ? Math.round(profit.marginPct) + ' %' : '—'
  const cash = r?.cashSummary

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Reporte Diario</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ height: 44, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--surface)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}
        />
      </div>

      {/* Tarjetas de estadísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {statCards.map((st, i) => (
          <div key={st.label} style={{ background: STAT_TINTS[i][0], borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: STAT_TINTS[i][1], textTransform: 'uppercase', letterSpacing: '.6px' }}>{st.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.5px', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{st.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        {/* Ventas por hora */}
        <div style={cardShell}>
          <div style={cardTitle}>Ventas por hora</div>
          {hasSales ? (
            hoursWithSales.map((h) => (
              <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                <span style={{ width: 48, fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{h.hour}:00</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#EEF2F7', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: '#6366F1', width: Math.round((h.total / maxHour) * 100) + '%' }} />
                </div>
                <span style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(h.total)}</span>
              </div>
            ))
          ) : (
            <EmptyDay />
          )}
        </div>

        {/* Por método de pago */}
        <div style={cardShell}>
          <div style={cardTitle}>Por método de pago</div>
          {hasSales ? (
            methodEntries.map(([m, v]) => {
              const label = methodLabel(m)
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                  <span style={{ width: 150, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#EEF2F7', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: methodTint(label)[1], width: Math.round((v / maxMethod) * 100) + '%' }} />
                  </div>
                  <span style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(v)}</span>
                </div>
              )
            })
          ) : (
            <EmptyDay />
          )}
        </div>

        {/* Top 5 productos */}
        <div style={cardShell}>
          <div style={cardTitle}>Top 5 productos</div>
          {hasSales ? (
            topRows.map((t) => (
              <div key={t.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #F3F7F5' }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {t.quantity} und · <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(t.revenue)}</b>
                </span>
              </div>
            ))
          ) : (
            <EmptyDay />
          )}
        </div>

        {/* Utilidad */}
        <div style={cardShell}>
          <div style={cardTitle}>Utilidad</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '7px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Ventas</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(profit?.sales ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '7px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Costo</span>
            <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>− {s.fmt(profit?.costOfGoods ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '7px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Utilidad operacional</span>
            <span style={{ color: '#4338CA', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {s.fmt(profit?.gross ?? 0)} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {margen}</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '7px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Gastos de caja</span>
            <span style={{ color: '#C9433B', fontVariantNumeric: 'tabular-nums' }}>− {s.fmt(profit?.expenses ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, marginTop: 6, borderTop: '1px dashed #E2E5EC' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Utilidad neta</span>
            <span style={{ fontWeight: 800, fontSize: 19, color: '#4338CA', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(profit?.net ?? 0)}</span>
          </div>
        </div>

        {/* Resumen de caja */}
        <div style={cardShell}>
          <div style={cardTitle}>Resumen de caja</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '8px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Apertura</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.fmt(cash?.openingBalance ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '8px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Ventas del día</span>
            <span style={{ color: '#6366F1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+ {s.fmt(cash?.totalSales ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '8px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Ingresos de caja</span>
            <span style={{ color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>+ {s.fmt(cash?.incomes ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '8px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Gastos de caja</span>
            <span style={{ color: '#C9433B', fontVariantNumeric: 'tabular-nums' }}>− {s.fmt(cash?.expenses ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, marginTop: 6, borderTop: '1px dashed #E2E5EC' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Saldo esperado</span>
            <span style={{ fontWeight: 800, fontSize: 19, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(cash?.expectedBalance ?? 0)}</span>
          </div>
        </div>

        {/* Historial de turnos cerrados */}
        {s.shifts.length > 0 && (
          <div style={cardShell}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>
              Turnos cerrados
            </div>
            {s.shifts.map((t) => {
              const diff = t.difference
              const diffColor = diff === 0 ? '#6366F1' : diff > 0 ? '#B4740A' : '#C9433B'
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid #EEF2F7', fontSize: 13.5, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(t.closedAt).toLocaleString('es-CO', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>Contado {s.fmt(t.countedBalance)}</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: diffColor }}>
                    {diff >= 0 ? '+ ' : '− '}
                    {s.fmt(Math.abs(diff))}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
