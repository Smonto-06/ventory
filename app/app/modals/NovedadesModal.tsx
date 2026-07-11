'use client'

// Modal de Novedades — réplica 1:1 del prototipo (docs/prototype/Ventory POS.dc.html)

import { useApp } from '../store'
import { Modal } from '../ui'

const NOV_LIST = [
  { t: 'Panel con métricas en vivo', d: 'Ventas del día, métodos de pago y top productos.' },
  { t: 'Devoluciones y cambios', d: 'Devuelve artículos de cualquier venta y genera cambios.' },
  { t: 'Modo oscuro', d: 'Cambia el tema desde Ajustes › Apariencia.' },
]

export default function NovedadesModal() {
  const s = useApp()

  return (
    <Modal onClose={s.closeModal} maxWidth={420}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: 'linear-gradient(135deg,#10B981,#6366F1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2c3 2 5 5 5 9 0 2-1 4-2 5l-3 2-3-2c-1-1-2-3-2-5 0-4 2-7 5-9z" fill="#fff" />
            <circle cx="12" cy="9" r="1.6" fill="#6366F1" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Novedades</h2>
          <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Lo nuevo en Ventory</div>
        </div>
        <button
          onClick={s.closeModal}
          className="v-hover-bg"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'var(--bg)',
            color: '#5A616E',
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {NOV_LIST.map((n) => (
          <div key={n.t} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#D1FAE5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                marginTop: 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 8.5l2.5 2.5 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{n.t}</div>
              <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.4, marginTop: 1 }}>{n.d}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={s.closeModal}
        className="v-hover-primary"
        style={{
          width: '100%',
          height: 46,
          marginTop: 20,
          borderRadius: 12,
          background: '#6366F1',
          color: '#fff',
          fontWeight: 800,
          fontSize: 14.5,
          cursor: 'pointer',
          boxShadow: '0 8px 18px -8px #6366F1cc',
        }}
      >
        Entendido
      </button>
    </Modal>
  )
}
