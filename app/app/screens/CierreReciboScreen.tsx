'use client'

// Recibo de cierre de caja — formato ticket 80mm "térmico esencial":
// informe del turno (apertura, ventas con desglose por método, ingresos,
// gastos, esperado/contado/diferencia) y línea de firma del cajero.
// Se muestra tras cualquier cierre (de turno o del día).

import { useApp } from '../store'
import { methodLabel } from '../ui'

export default function CierreReciboScreen() {
  const s = useApp()
  const c = s.lastCierre

  if (!c) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => s.go('panel')} style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}>
          Ir al panel →
        </button>
      </div>
    )
  }

  const dateStr = new Date(c.closedAt).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const diffColor = c.difference === 0 ? '#6366F1' : c.difference > 0 ? '#B4740A' : '#C9433B'
  const methods = Object.entries(c.byMethod).sort((a, b) => b[1] - a[1])

  const kv = (label: string, value: string, opts?: { muted?: boolean; bold?: boolean; color?: string }) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1.5px 0' }}>
      <span style={{ color: opts?.muted ? '#6E7280' : 'var(--text)', fontWeight: opts?.bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: opts?.bold ? 700 : 400, color: opts?.color ?? (opts?.muted ? '#6E7280' : 'var(--text)') }}>
        {value}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', gap: 16 }}>
      <div style={{ width: 302, background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 16px', fontFamily: "'Courier New',monospace", fontSize: 12, color: 'var(--text)', boxShadow: '0 14px 30px -20px rgba(16,20,30,.4)', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.5px' }}>CIERRE DE CAJA</div>
          <div style={{ color: '#6E7280', fontSize: 10.5 }}>
            {[c.businessName, c.branchName].filter(Boolean).join(' · ')}
          </div>
          <div style={{ color: '#6E7280', fontSize: 10.5 }}>
            {dateStr}
            {c.cashierName ? ` · Cajero: ${c.cashierName}` : ''}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
        {kv('Apertura', s.fmt(c.openingBalance))}
        {kv(`Ventas (${c.salesCount})`, '+ ' + s.fmt(c.salesTotal))}
        {kv('Ingresos', '+ ' + s.fmt(c.incomes))}
        {kv('Gastos', '− ' + s.fmt(c.expenses))}

        {methods.length > 0 && (
          <>
            <div style={{ borderTop: '1px dashed var(--border)', margin: '9px 0' }} />
            {methods.map(([m, v]) => kv(methodLabel(m), s.fmt(v), { muted: true }))}
          </>
        )}

        <div style={{ borderTop: '1.5px solid var(--text)', margin: '9px 0' }} />
        {kv('Esperado', s.fmt(c.expectedBalance), { bold: true })}
        {kv('Contado', s.fmt(c.countedBalance), { bold: true })}
        {kv('Diferencia', (c.difference >= 0 ? '+ ' : '− ') + s.fmt(Math.abs(c.difference)), { bold: true, color: diffColor })}

        <div style={{ textAlign: 'center', marginTop: 16, color: '#6E7280', fontSize: 11 }}>
          Firma cajero: ______________
        </div>
      </div>

      <div data-no-print="true" style={{ width: 302, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {c.nextOpening !== null ? (
          <div style={{ background: '#EEF0FE', borderRadius: 12, padding: '10px 16px', fontSize: 13.5, color: '#4338CA', fontWeight: 700, textAlign: 'center' }}>
            Nuevo turno abierto con {s.fmt(c.nextOpening)}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            Jornada terminada — no se abrió un turno nuevo.
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            className="v-hover-bg"
            style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1.5px solid var(--border)' }}
          >
            Imprimir recibo
          </button>
          {c.nextOpening !== null ? (
            <button
              onClick={() => s.go('panel')}
              className="v-hover-primary"
              style={{ flex: 1.2, height: 48, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc' }}
            >
              Volver al panel
            </button>
          ) : (
            <button
              onClick={s.logout}
              style={{ flex: 1.2, height: 48, borderRadius: 12, background: '#C9433B', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 10px 22px -12px #C9433Bcc' }}
            >
              Cerrar sesión
            </button>
          )}
        </div>
        {c.nextOpening === null && (
          <button
            onClick={() => s.go('panel')}
            className="v-hover-underline"
            style={{ display: 'block', margin: '2px auto 0', fontSize: 13.5, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}
          >
            Volver al panel sin cerrar sesión
          </button>
        )}
      </div>
    </div>
  )
}
