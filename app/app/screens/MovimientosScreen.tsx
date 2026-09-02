'use client'

// Movimientos de caja — réplica 1:1 de la pantalla sMovimientos del prototipo
// (docs/prototype/Ventory POS.dc.html): formulario a la izquierda, lista del turno a la derecha.

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { chipStyle } from '../ui'
import CampoNumerico from '../modals/CampoNumerico'

const cardShell: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
}

const QUICK = [1000, 2000, 5000, 10000, 20000, 50000, 100000]

function typeBtnStyle(active: boolean, kind: 'INCOME' | 'EXPENSE'): CSSProperties {
  const color = kind === 'INCOME' ? '#6366F1' : '#C9433B'
  return {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'all .13s',
    border: active ? `1.5px solid ${color}` : '1.5px solid var(--border)',
    background: active ? color : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
  }
}

export default function MovimientosScreen() {
  const s = useApp()

  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [movDesc, setMovDesc] = useState('')
  const [movAmount, setMovAmount] = useState(0)
  const [movComment, setMovComment] = useState('')

  const descOpts = movType === 'INCOME' ? s.movementDescriptions.INCOME : s.movementDescriptions.EXPENSE
  const movOk = movAmount > 0 && !!movDesc

  const registrar = async () => {
    if (!movOk) return
    await s.addMov(movType, movDesc, movComment, movAmount)
    setMovDesc('')
    setMovAmount(0)
    setMovComment('')
  }

  const rows = [...s.movements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Movimientos de caja</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 10, background: '#EEF0FE', color: '#4338CA', fontWeight: 800, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
            Ingresos + {s.fmt(s.ingresos)}
          </span>
          <span style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 10, background: '#FDECEC', color: '#C9433B', fontWeight: 800, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
            Gastos − {s.fmt(s.gastos)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Formulario */}
        <div style={{ ...cardShell, flex: '1 1 340px', maxWidth: 520, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Registrar movimiento</div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setMovType('INCOME'); setMovDesc('') }}
              style={typeBtnStyle(movType === 'INCOME', 'INCOME')}
            >
              Ingreso
            </button>
            <button
              onClick={() => { setMovType('EXPENSE'); setMovDesc('') }}
              style={typeBtnStyle(movType === 'EXPENSE', 'EXPENSE')}
            >
              Gasto
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Descripción</label>
            <select
              value={movDesc}
              onChange={(e) => setMovDesc(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 14.5, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
            >
              <option value="">Selecciona una descripción…</option>
              {descOpts.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Monto</label>
            <CampoNumerico
              value={movAmount || ''}
              onChange={(raw) => setMovAmount(parseInt(raw.replace(/\D/g, '')) || 0)}
              titulo="Monto del movimiento"
              style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginTop: 10 }}>
              {QUICK.map((v) => (
                <button
                  key={v}
                  className="v-hover-bg"
                  onClick={() => setMovAmount((a) => a + v)}
                  style={{ height: 40, borderRadius: 10, background: '#EEF2F7', color: '#2A303B', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.fmt(v)}
                </button>
              ))}
            </div>
          </div>

          <input
            value={movComment}
            onChange={(e) => setMovComment(e.target.value)}
            placeholder="Comentario (opcional)…"
            style={{ width: '100%', height: 38, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 14.5 }}
          />

          <button
            onClick={registrar}
            disabled={!movOk}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 15.5,
              color: '#fff',
              cursor: movOk ? 'pointer' : 'not-allowed',
              background: movOk ? (movType === 'INCOME' ? '#6366F1' : '#C9433B') : '#C7CDEC',
            }}
          >
            Registrar movimiento
          </button>
        </div>

        {/* Lista de movimientos del turno */}
        <div style={{ ...cardShell, flex: '1 1 360px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 15, borderBottom: '1px solid #EEF2F7' }}>Movimientos del turno</div>
          {rows.length > 0 ? (
            rows.map((m) => {
              const ingreso = m.type === 'INCOME'
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #EEF2F7', flexWrap: 'wrap' }}>
                  <span style={chipStyle(...(ingreso ? (['#EEF0FE', '#4338CA'] as [string, string]) : (['#FDECEC', '#C9433B'] as [string, string])))}>
                    {ingreso ? 'Ingreso' : 'Gasto'}
                  </span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.description}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                      {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {m.comment ? ` · ${m.comment}` : ''}
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: ingreso ? '#4338CA' : '#C9433B' }}>
                    {ingreso ? '+ ' : '− '}
                    {s.fmt(m.amount)}
                  </span>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '44px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              Sin movimientos en este turno.
              <br />
              <span style={{ fontSize: 13 }}>Registra aquí los ingresos y gastos de caja.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
