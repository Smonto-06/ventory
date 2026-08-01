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

type Mode = 'dia' | 'semana' | 'mes' | 'rango'

function daysAgoStr(n: number): string {
  const d = new Date(Date.now() - n * 86400000)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function monthStartStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

// Píldora de variación vs. período anterior (verde sube, rojo baja)
function ChangePill({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: up ? '#D1FAE5' : '#FDECEC', color: up ? '#0B6E63' : '#C9433B', verticalAlign: 'middle' }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toLocaleString('es-CO')}%
    </span>
  )
}

export default function ReportesScreen() {
  const s = useApp()
  const [date, setDate] = useState(todayStr)
  const [mode, setMode] = useState<Mode>('dia')
  const [from, setFrom] = useState(daysAgoStr(6))
  const [to, setTo] = useState(todayStr)

  useEffect(() => {
    if (mode === 'dia') {
      s.loadReport(date)
      return
    }
    const f = mode === 'semana' ? daysAgoStr(6) : mode === 'mes' ? monthStartStr() : from
    const t = mode === 'rango' ? to : todayStr()
    if (f && t) s.loadRangeReport(f, t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mode, from, to])

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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>
          {mode === 'dia' ? 'Reporte Diario' : 'Reporte por período'}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(
            [
              ['dia', 'Día'],
              ['semana', '7 días'],
              ['mes', 'Este mes'],
              ['rango', 'Rango'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              style={{
                height: 40, padding: '0 14px', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', transition: 'all .13s',
                border: mode === k ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
                background: mode === k ? '#6366F1' : 'var(--surface)',
                color: mode === k ? '#fff' : 'var(--text)',
              }}
            >
              {label}
            </button>
          ))}
          {mode === 'dia' && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ height: 44, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--surface)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}
            />
          )}
          {mode === 'rango' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ height: 44, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--surface)', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }} />
              <span style={{ color: 'var(--muted)' }}>→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ height: 44, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--surface)', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }} />
            </>
          )}
        </div>
      </div>

      {mode !== 'dia' && <RangePanel />}

      {mode === 'dia' && (
      <>
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
            <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(cash?.totalSales ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '8px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Ventas en efectivo</span>
            <span style={{ color: '#6366F1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+ {s.fmt(cash?.cashSales ?? 0)}</span>
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
      </>
      )}
    </div>
  )
}

// ─── Panel de rango (7 días / mes / rango libre) ─────────────────────────────

function RangePanel() {
  const s = useApp()
  const r = s.rangeReport
  if (!r) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>

  const hasSales = r.summary.transactionCount > 0
  const maxDay = Math.max(1, ...r.salesByDay.map((d) => d.total))
  const methodEntries = Object.entries(r.byPaymentMethod)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const maxMethod = Math.max(1, ...methodEntries.map(([, v]) => v))
  const fday = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

  const stat = (label: string, value: string, pct: number | null, tint: [string, string]) => (
    <div key={label} style={{ background: tint[0], borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: tint[1], textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.5px', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        <ChangePill pct={pct} />
      </div>
    </div>
  )

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        {fday(r.from)} — {fday(r.to)} · {r.days} día{r.days === 1 ? '' : 's'} · comparado con los {r.days} día{r.days === 1 ? '' : 's'} anteriores
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {stat('Total ventas', s.fmt(r.summary.totalSales), r.comparison.salesChangePct, ['#EEF0FE', '#4338CA'])}
        {stat('Transacciones', String(r.summary.transactionCount), r.comparison.countChangePct, ['#F2EEFB', '#7B4FD4'])}
        {stat('Venta promedio', s.fmt(r.summary.averageSale), null, ['#FDF1E7', '#B4740A'])}
        {stat('Utilidad neta', s.fmt(r.profit.net), r.comparison.netChangePct, ['#E9F4F8', '#2E8CB0'])}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <div style={cardShell}>
          <div style={cardTitle}>Ventas por día</div>
          {hasSales ? (
            r.salesByDay.map((d) => (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
                <span style={{ width: 64, fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fday(d.date)}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#EEF2F7', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: '#6366F1', width: Math.round((d.total / maxDay) * 100) + '%' }} />
                </div>
                <span style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(d.total)}</span>
              </div>
            ))
          ) : (
            <EmptyDay />
          )}
        </div>

        <div style={cardShell}>
          <div style={cardTitle}>Por método de pago</div>
          {hasSales ? (
            methodEntries.map(([m, v]) => {
              const label = methodLabel(m)
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                  <span style={{ width: 130, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
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

        <div style={cardShell}>
          <div style={cardTitle}>Top 10 productos</div>
          {hasSales ? (
            r.topProducts.map((t) => (
              <div key={t.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #F3F7F5' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {Number.isInteger(t.quantity) ? t.quantity : t.quantity.toLocaleString('es-CO')} ·{' '}
                  <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(t.revenue)}</b>
                </span>
              </div>
            ))
          ) : (
            <EmptyDay />
          )}
        </div>

        <div style={cardShell}>
          <div style={cardTitle}>Utilidad del período</div>
          {(
            [
              ['Ventas', s.fmt(r.profit.sales), 'var(--text)'],
              ['Costo de lo vendido', '− ' + s.fmt(r.profit.costOfGoods), 'var(--muted)'],
              ['Utilidad operacional', `${s.fmt(r.profit.gross)} · ${Math.round(r.profit.marginPct)} %`, '#4338CA'],
              ['Gastos de caja', '− ' + s.fmt(r.profit.expenses), '#C9433B'],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '7px 0' }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, marginTop: 6, borderTop: '1px dashed #E2E5EC' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Utilidad neta</span>
            <span style={{ fontWeight: 800, fontSize: 19, color: '#4338CA', fontVariantNumeric: 'tabular-nums' }}>
              {s.fmt(r.profit.net)}
              <ChangePill pct={r.comparison.netChangePct} />
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
