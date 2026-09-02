'use client'

// Cierre de caja — réplica 1:1 del prototipo (sección sCierre), con
// calculadora de conteo de billetes/monedas e historial de turnos.

import { useState } from 'react'
import { useApp } from '../store'
import { BILLS, COINS } from '../ui'
import CampoNumerico from '../modals/CampoNumerico'

export default function CierreScreen() {
  const s = useApp()
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [declared, setDeclared] = useState(0)
  const [calcOpen, setCalcOpen] = useState(false)

  const counted = Object.entries(counts).reduce((a, [v, c]) => a + Number(v) * (c || 0), 0)
  const diff = declared - s.esperado

  const setCount = (denom: number, raw: string) => {
    const c = parseInt((raw || '').replace(/\D/g, '')) || 0
    const next = { ...counts, [denom]: c }
    setCounts(next)
    setDeclared(Object.entries(next).reduce((a, [v, n]) => a + Number(v) * (n || 0), 0))
  }

  const countRow = (v: number) => (
    <div key={v} style={{ display: 'grid', gridTemplateColumns: '1fr 78px 1fr', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(v)}</span>
      <CampoNumerico
        value={counts[v] || ''}
        onChange={(raw) => setCount(v, raw)}
        titulo={`${s.fmt(v)} — cuántos`}
        style={{ height: 38, border: '1.5px solid var(--border)', borderRadius: 9, background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14 }}
      />
      <span style={{ textAlign: 'right', fontSize: 13.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        {counts[v] ? s.fmt(counts[v] * v) : ''}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(900px 500px at 50% -5%, #EEF0FE 0%, var(--bg) 55%)' }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, boxShadow: '0 24px 50px -30px rgba(16,20,30,.28)', animation: 'vfade .35s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#EEF0FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="2" fill="#6366F1" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="#6366F1" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.3px' }}>Cerrar caja</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>{s.cash.session?.branch.name ?? 'Sin turno abierto'}</div>
            </div>
          </div>

          {!s.turnoAbierto ? (
            <div>
              <div style={{ padding: '6px 0 20px', color: 'var(--muted)', fontSize: 14.5 }}>
                No hay un turno de caja abierto. Para cerrar caja primero debes abrir un turno.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => s.go('panel')}
                  style={{ flex: 1, height: 50, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                >
                  ← Volver al panel
                </button>
                <button
                  onClick={() => s.openModal('aperturaCaja')}
                  className="v-hover-primary"
                  style={{ flex: 1.4, height: 50, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 22px -12px #6366F1cc' }}
                >
                  Abrir caja
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ borderTop: '1px solid #EEF2F7', paddingTop: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 14 }}>
                  Resumen del turno
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Apertura</span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.apertura)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Ventas del turno</span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.ventasTurno)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Ventas en efectivo</span>
                  <span style={{ color: '#6366F1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+ {s.fmt(s.ventasEfectivo)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Ingresos de caja</span>
                  <span style={{ color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>+ {s.fmt(s.ingresos)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Gastos de caja</span>
                  <span style={{ color: '#C9433B', fontVariantNumeric: 'tabular-nums' }}>− {s.fmt(s.gastos)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14, borderTop: '1px dashed #E2E5EC' }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Saldo esperado</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(s.esperado)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Total contado</label>
                  <CampoNumerico
                    value={declared || ''}
                    onChange={(raw) => setDeclared(parseInt(raw.replace(/\D/g, '')) || 0)}
                    titulo="Total contado"
                    style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--input)', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                <button
                  onClick={() => setCalcOpen((v) => !v)}
                  title="Calculadora de conteo"
                  style={{ width: 48, height: 48, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .13s', background: calcOpen ? '#6366F1' : '#EEF0FE', color: calcOpen ? '#fff' : '#6366F1', boxShadow: calcOpen ? '0 8px 18px -8px #6366F1cc' : undefined }}
                >
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="1.8" width="10" height="12.4" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="5.2" y="4" width="5.6" height="2.4" rx="0.8" fill="currentColor" />
                    <circle cx="6.1" cy="9" r="0.95" fill="currentColor" />
                    <circle cx="9.9" cy="9" r="0.95" fill="currentColor" />
                    <circle cx="6.1" cy="11.8" r="0.95" fill="currentColor" />
                    <circle cx="9.9" cy="11.8" r="0.95" fill="currentColor" />
                  </svg>
                </button>
              </div>

              {calcOpen && (
                <div style={{ marginTop: 14, border: '1.5px solid var(--border)', borderRadius: 14, padding: 16, background: 'var(--input)', animation: 'vfade .25s ease' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.7px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Billetes</div>
                  {BILLS.map(countRow)}
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.7px', color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 8px' }}>Monedas</div>
                  {COINS.map(countRow)}
                  <div style={{ borderTop: '1px dashed #E2E5EC', marginTop: 12, paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 800 }}>Total contado</span>
                      <span style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(counted)}</span>
                    </div>
                  </div>
                </div>
              )}

              {declared > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, background: diff === 0 ? '#EEF0FE' : diff > 0 ? '#FDF4E5' : '#FDECEC', borderRadius: 11, padding: '12px 16px', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Diferencia vs. esperado</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: diff === 0 ? '#6366F1' : diff > 0 ? '#B4740A' : '#C9433B' }}>
                    {(diff >= 0 ? '+ ' : '− ') + s.fmt(Math.abs(diff))}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button onClick={() => s.go('pos')} style={{ flex: 1, height: 50, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  onClick={() => s.doCierre(declared)}
                  style={{ flex: 1.4, height: 50, borderRadius: 12, background: '#C9433B', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 22px -12px #C9433Bcc' }}
                >
                  Cerrar caja
                </button>
              </div>
            </>
          )}
        </div>

        {s.shifts.length > 0 && (
          <div style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '22px 24px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>
              Turnos cerrados
            </div>
            {s.shifts.slice(0, 8).map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid #EEF2F7', fontSize: 13.5, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(t.closedAt).toLocaleString('es-CO', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>Contado {s.fmt(t.countedBalance)}</span>
                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: t.difference === 0 ? '#6366F1' : t.difference > 0 ? '#B4740A' : '#C9433B' }}>
                  {(t.difference >= 0 ? '+ ' : '− ') + s.fmt(Math.abs(t.difference))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
