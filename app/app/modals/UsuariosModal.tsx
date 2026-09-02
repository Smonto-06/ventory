'use client'

// Modal de Gestión de usuarios — réplica 1:1 del prototipo (docs/prototype/Ventory POS.dc.html)

import { useApp } from '../store'
import { Modal, chipStyle } from '../ui'

export default function UsuariosModal() {
  const s = useApp()

  return (
    <Modal onClose={s.closeModal} maxWidth={520}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Gestión de usuarios</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => {
              s.setEditUserId(null)
              s.openModal('usuarioForm')
            }}
            className="v-hover-primary"
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 10,
              background: '#6366F1',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            + Nuevo usuario
          </button>
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
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {s.users.map((u) => {
          const isAdminRole = u.role === 'ADMIN' || u.role === 'SUPERVISOR'
          const isMe = u.email === s.me.email
          return (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderBottom: '1px solid var(--border)',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#10B981,#6366F1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  flex: 'none',
                }}
              >
                {(u.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {u.branch?.name ? `${u.email} · ${u.branch.name}` : u.email}
                </div>
              </div>
              <span style={isAdminRole ? chipStyle('#EEF0FE', '#4338CA') : chipStyle('#D1FAE5', '#0B6E63')}>
                {u.role === 'ADMIN' ? 'Administrador' : u.role === 'SUPERVISOR' ? 'Encargado' : 'Cajero'}
              </span>
              <span style={u.isActive ? chipStyle('#D1FAE5', '#0B6E63') : chipStyle('#FDECEC', '#C9433B')}>
                {u.isActive ? 'Activo' : 'Inactivo'}
              </span>
              {u.hasPin && <span style={chipStyle('#EEF0FE', '#4338CA')}>PIN</span>}
              <button
                onClick={() => {
                  s.setEditUserId(u.id)
                  s.openModal('usuarioForm')
                }}
                className="v-hover-underline"
                style={{ fontSize: 13, color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}
              >
                Editar
              </button>
              {!isMe && (
                <button
                  onClick={() => s.toggleUser(u)}
                  className="v-hover-danger"
                  style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700, cursor: 'pointer' }}
                >
                  {u.isActive ? 'Desactivar' : 'Activar'}
                </button>
              )}
              {!isMe && (
                <button
                  onClick={() =>
                    s.askConfirm({
                      title: `¿Eliminar a ${u.name ?? u.email}?`,
                      label:
                        'Solo se elimina un empleado sin historial. Si ya vendió o abrió caja, el sistema pedirá desactivarlo en su lugar.',
                      btnLabel: 'Eliminar',
                      onConfirm: () => s.deleteUser(u),
                    })
                  }
                  className="v-hover-danger"
                  style={{ fontSize: 13, color: '#C9433B', fontWeight: 700, cursor: 'pointer' }}
                >
                  Eliminar
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: '#94A3B8' }}>
        Solo el administrador puede crear cuentas. Los cajeros no ven costos, compras, reportes ni ajustes.
      </div>
    </Modal>
  )
}
