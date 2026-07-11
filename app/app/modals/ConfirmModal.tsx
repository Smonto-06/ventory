'use client'

// Confirmación destructiva (anular venta, eliminar espera/cliente…) —
// réplica 1:1 del prototipo (mConfirmEspera).

import { useApp } from '../store'

export default function ConfirmModal() {
  const s = useApp()
  const c = s.confirm
  if (!c) return null

  return (
    <div
      data-no-print="true"
      onClick={s.closeModal}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
      >
        <div style={{ width: 46, height: 46, borderRadius: 13, background: '#FDECEC', color: '#C9433B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 5h9M6.5 5V3.8a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V5M5 5l.6 8a1.5 1.5 0 0 0 1.5 1.4h1.8A1.5 1.5 0 0 0 10.4 13l.6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{c.title}</h2>
        <div style={{ marginTop: 8, background: 'var(--bg)', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {c.label}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>Esta acción no se puede deshacer.</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={s.closeModal} style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={() => c.onConfirm()}
            style={{ flex: 1, height: 46, borderRadius: 12, background: '#C9433B', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -10px #C9433Bcc' }}
          >
            {c.btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
