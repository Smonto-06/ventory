'use client'

// Recibo de cierre de turno — informe imprimible con el resumen del turno:
// apertura, ventas (con desglose por método), ingresos, gastos, esperado,
// contado y diferencia. Se muestra tras cualquier cierre (de turno o del día).

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

  const row = (label: string, value: string, opts?: { color?: string; bold?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, padding: '6px 0' }}>
      <span style={{ color: opts?.bold ? 'var(--text)' : 'var(--muted)', fontWeight: opts?.bold ? 800 : 500 }}>{label}</span>
      <span style={{ fontWeight: opts?.bold ? 800 : 700, fontVariantNumeric: 'tabular-nums', color: opts?.color ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(900px 500px at 50% -5%, #EEF0FE 0%, var(--bg) 55%)' }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 50px -30px rgba(16,20,30,.28)', animation: 'vpop .35s ease' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', boxShadow: '0 10px 22px -8px #6366F199' }}>
            ✓
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 14 }}>
            {c.nextOpening !== null ? 'Cierre de turno' : 'Cierre del día'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{dateStr}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', margin: '20px 0 14px', fontSize: 13.5 }}>
          <div>
            Sucursal: <b>{c.branchName}</b>
          </div>
          <div>
            Cajero: <b>{c.cashierName}</b>
          </div>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', margin: '14px 0 4px' }}>
          Resumen del turno
        </div>
        {row('Apertura', s.fmt(c.openingBalance))}
        {row(`Ventas (${c.salesCount} ${c.salesCount === 1 ? 'venta' : 'ventas'})`, '+ ' + s.fmt(c.salesTotal), { color: '#6366F1' })}
        {row('Ingresos de caja', '+ ' + s.fmt(c.incomes), { color: '#6366F1' })}
        {row('Gastos de caja', '− ' + s.fmt(c.expenses), { color: '#C9433B' })}

        {methods.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', margin: '14px 0 4px' }}>
              Ventas por método de pago
            </div>
            {methods.map(([m, v]) => row(methodLabel(m), s.fmt(v)))}
          </>
        )}

        <div style={{ borderTop: '1px dashed #E2E5EC', marginTop: 12, paddingTop: 10 }}>
          {row('Saldo esperado', s.fmt(c.expectedBalance), { bold: true })}
          {row('Total contado', s.fmt(c.countedBalance), { bold: true })}
          {row('Diferencia', (c.difference >= 0 ? '+ ' : '− ') + s.fmt(Math.abs(c.difference)), { bold: true, color: diffColor })}
        </div>

        {c.nextOpening !== null ? (
          <div style={{ marginTop: 14, background: '#EEF0FE', borderRadius: 12, padding: '11px 16px', fontSize: 14, color: '#4338CA', fontWeight: 700, textAlign: 'center' }}>
            Nuevo turno abierto con {s.fmt(c.nextOpening)}
          </div>
        ) : (
          <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 12, padding: '11px 16px', fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
            Jornada terminada — no se abrió un turno nuevo.
          </div>
        )}

        <div data-no-print="true" style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            onClick={() => window.print()}
            className="v-hover-bg"
            style={{ flex: 1, height: 50, borderRadius: 13, background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', border: '1.5px solid var(--border)' }}
          >
            Imprimir recibo
          </button>
          {c.nextOpening !== null ? (
            <button
              onClick={() => s.go('panel')}
              className="v-hover-primary"
              style={{ flex: 1.2, height: 50, borderRadius: 13, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc' }}
            >
              Volver al panel
            </button>
          ) : (
            <button
              onClick={s.logout}
              style={{ flex: 1.2, height: 50, borderRadius: 13, background: '#C9433B', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 22px -12px #C9433Bcc' }}
            >
              Cerrar sesión
            </button>
          )}
        </div>
        {c.nextOpening === null && (
          <button
            data-no-print="true"
            onClick={() => s.go('panel')}
            className="v-hover-underline"
            style={{ display: 'block', margin: '12px auto 0', fontSize: 13.5, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}
          >
            Volver al panel sin cerrar sesión
          </button>
        )}
      </div>
    </div>
  )
}
