'use client'

// Pantalla Clientes — réplica 1:1 del bloque sClientes del prototipo
// (docs/prototype/Ventory POS.dc.html).

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
}

export function saldoChipStyle(hasSaldo: boolean): CSSProperties {
  return hasSaldo
    ? {
        background: '#FDF4E5',
        color: '#B4740A',
        fontWeight: 800,
        fontSize: 13,
        padding: '6px 12px',
        borderRadius: 9,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }
    : { color: 'var(--muted)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }
}

export function PayIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export default function ClientesScreen() {
  const s = useApp()
  const [query, setQuery] = useState('')

  const cq = query.trim().toLowerCase()
  const rows = s.customers.filter(
    (c) =>
      !cq ||
      c.name.toLowerCase().includes(cq) ||
      (c.phone ?? '').includes(cq) ||
      (c.document ?? '').includes(cq),
  )

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Clientes</h1>
        <button
          onClick={() => {
            s.setEditClientId(null)
            s.openModal('cliente')
          }}
          className="v-hover-primary"
          style={{
            height: 44,
            padding: '0 18px',
            borderRadius: 11,
            background: '#6366F1',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14.5,
            cursor: 'pointer',
            boxShadow: '0 8px 18px -8px #6366F1cc',
          }}
        >
          + Nuevo cliente
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, teléfono, documento…"
        style={{
          width: '100%',
          height: 48,
          padding: '0 16px',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          background: 'var(--surface)',
          fontSize: 14.5,
        }}
      />

      {rows.length > 0 ? (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {rows.map((c) => (
            <div
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 20px', borderBottom: '1px solid #EEF2F7', flexWrap: 'wrap' }}
            >
              <button
                onClick={() => {
                  s.setPerfilId(c.id)
                  s.go('clienteperfil')
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 180, textAlign: 'left', cursor: 'pointer', padding: 0, background: 'none' }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#EEF0FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366F1',
                    fontWeight: 700,
                    fontSize: 15,
                    flex: 'none',
                  }}
                >
                  {c.name[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {c.phone ?? '—'} · CC {c.document ?? '—'} ·{' '}
                    <span style={{ color: '#6366F1', fontWeight: 600 }}>Ver perfil →</span>
                  </div>
                </div>
              </button>
              <span style={saldoChipStyle(c.balance > 0)}>
                {c.balance > 0 ? `Saldo: ${s.fmt(c.balance)}` : 'Sin saldo'}
              </span>
              {c.balance > 0 && (
                <button
                  onClick={() => {
                    s.setAbonoId(c.id)
                    s.openModal('abono')
                  }}
                  title="Registrar abono"
                  style={{
                    width: 40,
                    height: 40,
                    flex: 'none',
                    borderRadius: 11,
                    background: '#EEF0FE',
                    color: '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all .13s',
                  }}
                >
                  <PayIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: '50px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14.5 }}>
          {`Sin resultados para "${query}"`}
        </div>
      )}
    </div>
  )
}
