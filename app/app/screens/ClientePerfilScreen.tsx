'use client'

// Perfil de cliente — réplica 1:1 del bloque sPerfil del prototipo
// (docs/prototype/Ventory POS.dc.html): cabecera con avatar, saldo y acciones,
// más historial de compras del cliente.

import { CSSProperties } from 'react'
import { useApp } from '../store'
import { chipStyle, methodLabel, methodTint } from '../ui'
import { saldoChipStyle, PayIcon } from './ClientesScreen'

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
}

function fechaStr(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function ClientePerfilScreen() {
  const s = useApp()
  const c = s.customers.find((x) => x.id === s.perfilId)

  const ventas = c ? s.sales.filter((v) => v.customer?.id === c.id) : []

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <button
        onClick={() => s.go('clientes')}
        className="v-hover-underline"
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, color: '#5A616E', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
      >
        ← Clientes
      </button>

      <div style={{ ...cardStyle, padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#EEF0FE',
            color: '#6366F1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 22,
            flex: 'none',
          }}
        >
          {(c?.name || '?')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.3px' }}>{c?.name ?? ''}</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 3 }}>
            {c?.phone ?? '—'} · CC {c?.document ?? '—'}
          </div>
        </div>
        <span style={saldoChipStyle(!!c && c.balance > 0)}>
          {c && c.balance > 0 ? `Saldo: ${s.fmt(c.balance)}` : 'Sin saldo'}
        </span>
        {c && c.balance > 0 && (
          <button
            onClick={() => {
              s.setAbonoId(c.id)
              s.openModal('abono')
            }}
            title="Registrar abono"
            style={{
              width: 42,
              height: 42,
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
        {c && (
          <button
            onClick={() => {
              s.setEditClientId(c.id)
              s.openModal('cliente')
            }}
            className="v-hover-bg"
            style={{ height: 42, padding: '0 16px', borderRadius: 11, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
          >
            Editar
          </button>
        )}
        {c && (
          <button
            onClick={() =>
              s.askConfirm({
                title: '¿Eliminar este cliente?',
                label: `${c.name}${c.balance > 0 ? ' · Saldo pendiente: ' + s.fmt(c.balance) : ' · Sin saldo pendiente'}`,
                btnLabel: 'Eliminar',
                onConfirm: () => s.deleteCliente(c.id),
              })
            }
            title="Eliminar cliente"
            style={{
              width: 42,
              height: 42,
              flex: 'none',
              borderRadius: 11,
              background: '#FDECEC',
              color: '#C9433B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all .13s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 5h9M6.5 5V3.8a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V5M5 5l.6 8a1.5 1.5 0 0 0 1.5 1.4h1.8A1.5 1.5 0 0 0 10.4 13l.6-8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 15, borderBottom: '1px solid #EEF2F7' }}>Compras del cliente</div>
        {ventas.length > 0 ? (
          ventas.map((v) => {
            const count = v.items.reduce((a, i) => a + i.quantity, 0)
            const label = methodLabel(v.paymentMethod, v.payments)
            const [bg, fg] = methodTint(label)
            return (
              <button
                key={v.id}
                onClick={() => {
                  s.setSaleDetId(v.id)
                  s.openModal('ventaDetalle')
                }}
                className="v-hover-row"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'none',
                }}
              >
                <div style={{ minWidth: 110 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#6366F1' }}>{v.folio}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{fechaStr(v.createdAt)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <span style={chipStyle(bg, fg)}>{label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {count} {count === 1 ? 'art.' : 'arts.'}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>
                  {s.fmt(v.total)}
                </div>
                <span style={{ color: '#6366F1', fontWeight: 800, fontSize: 15 }}>→</span>
              </button>
            )
          })
        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Sin compras registradas en esta sesión.
          </div>
        )}
      </div>
    </div>
  )
}
