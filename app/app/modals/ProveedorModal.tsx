'use client'

// Modal PROVEEDOR (crear / editar) — réplica 1:1 del prototipo (mProv).

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle, inputStyle, labelStyle } from '../ui'

export default function ProveedorModal() {
  const s = useApp()
  const editing = s.editProvId ? s.suppliers.find((p) => p.id === s.editProvId) ?? null : null

  const [name, setName] = useState(editing?.name ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')

  const ok = !!name.trim()

  const save = async () => {
    if (!ok) {
      s.toast('Escribe el nombre del proveedor')
      return
    }
    const done = await s.saveProv({ name: name.trim(), phone: phone.trim() || undefined }, s.editProvId)
    if (done) s.closeModal()
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={420}>
      <ModalTitle onClose={s.closeModal}>{s.editProvId ? 'Editar proveedor' : 'Nuevo proveedor'}</ModalTitle>
      <label style={{ ...labelStyle, margin: '11px 0 5px' }}>Nombre</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Textiles del Sur"
        style={{ ...inputStyle, height: 38, fontSize: 14.5 }}
      />
      <label style={{ ...labelStyle, margin: '10px 0 5px' }}>Teléfono</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="3001234567"
        style={{ ...inputStyle, height: 38, fontSize: 14.5, fontVariantNumeric: 'tabular-nums' }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={s.closeModal}
          className="v-hover-bg"
          style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button onClick={save} style={saveBtnStyle(ok)}>
          {s.editProvId ? 'Guardar cambios' : 'Guardar proveedor'}
        </button>
      </div>
    </Modal>
  )
}
