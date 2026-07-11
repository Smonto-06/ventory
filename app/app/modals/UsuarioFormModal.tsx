'use client'

// Modal de formulario de usuario (crear / editar) — réplica 1:1 del prototipo
// (docs/prototype/Ventory POS.dc.html). Cerrar o cancelar vuelve a la lista.

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, saveBtnStyle } from '../ui'

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '11px 0 5px',
}

const fieldInputStyle: CSSProperties = {
  width: '100%',
  height: 42,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 14.5,
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: 42,
  padding: '0 12px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
}

export default function UsuarioFormModal() {
  const s = useApp()
  const editing = s.editUserId ? s.users.find((u) => u.id === s.editUserId) ?? null : null

  const [name, setName] = useState(editing?.name ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>(
    editing && (editing.role === 'ADMIN' || editing.role === 'SUPERVISOR') ? 'ADMIN' : 'CASHIER',
  )
  const [branchId, setBranchId] = useState(editing?.branchId ?? '')
  const [password, setPassword] = useState('')

  const backToUsuarios = () => s.openModal('usuarios')

  const save = async () => {
    if (!name.trim()) return s.toast('Escribe el nombre del usuario')
    if (!email.trim()) return s.toast('Escribe el correo del usuario')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return s.toast('El correo no tiene un formato válido')
    if (!editing && password.length < 8) return s.toast('La contraseña debe tener al menos 8 caracteres')
    if (editing && password && password.length < 8) return s.toast('La contraseña debe tener al menos 8 caracteres')
    const ok = await s.saveUser(
      {
        name: name.trim(),
        email: email.trim(),
        role,
        branchId: branchId || null,
        ...(password ? { password } : {}),
      },
      s.editUserId,
    )
    if (ok) s.openModal('usuarios')
  }

  return (
    <Modal onClose={backToUsuarios} maxWidth={420}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={backToUsuarios}
            className="v-hover-bg"
            title="Volver a usuarios"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--bg)',
              color: '#6366F1',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              flex: 'none',
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>
            {editing ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
        </div>
        <button
          onClick={backToUsuarios}
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

      <label style={{ ...fieldLabelStyle, margin: '14px 0 5px' }}>Nombre</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del usuario"
        style={fieldInputStyle}
      />
      <label style={fieldLabelStyle}>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        inputMode="email"
        placeholder="usuario@ventory.com"
        style={fieldInputStyle}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabelStyle}>Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'CASHIER')} style={selectStyle}>
            <option value="CASHIER">Cajero</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div>
          <label style={fieldLabelStyle}>Sucursal</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={selectStyle}>
            <option value="">Sin sucursal</option>
            {s.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label style={fieldLabelStyle}>Contraseña</label>
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder={editing ? 'Dejar en blanco para no cambiarla' : 'Mínimo 8 caracteres'}
        style={fieldInputStyle}
      />
      {editing && (
        <div style={{ marginTop: 6, fontSize: 12.5, color: '#94A3B8' }}>Dejar en blanco para no cambiarla.</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={backToUsuarios}
          className="v-hover-bg"
          style={{
            flex: 1,
            height: 46,
            borderRadius: 12,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button onClick={save} style={{ ...saveBtnStyle(!!(name.trim() && email.trim())), height: 46 }}>
          Guardar usuario
        </button>
      </div>
    </Modal>
  )
}
