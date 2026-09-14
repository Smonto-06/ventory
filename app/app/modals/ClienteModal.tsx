'use client'

// Modal Nuevo/Editar cliente — réplica del bloque mCliente del prototipo
// (docs/prototype/Ventory POS.dc.html). Guarda vía s.saveCliente().

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle, inputStyle, labelStyle } from '../ui'

export default function ClienteModal() {
  const s = useApp()
  const editing = s.editClientId ? s.customers.find((c) => c.id === s.editClientId) : undefined

  const [name, setName] = useState(editing?.name ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [doc, setDoc] = useState(editing?.document ?? '')
  const [creditLimit, setCreditLimit] = useState(
    editing?.creditLimit !== undefined && editing?.creditLimit !== null ? String(editing.creditLimit) : '',
  )
  const [enviando, setEnviando] = useState(false)

  const ok = !!name.trim() && !enviando

  const save = async () => {
    // Un doble clic rápido en "Guardar" podía crear DOS clientes idénticos
    // antes de que la primera petición terminara y cerrara el modal — mismo
    // patrón que ya bloquean caja, crédito, compras y traslados.
    if (enviando) return
    if (!name.trim()) {
      s.toast('Escribe el nombre del cliente')
      return
    }
    setEnviando(true)
    try {
      const saved = await s.saveCliente(
        {
          name: name.trim(),
          phone: phone.trim() || undefined,
          document: doc.trim() || undefined,
          // Siempre se manda (aunque quede vacío) para que un encargado/
          // administrador pueda QUITAR un límite ya puesto, no solo ponerlo.
          ...(s.isAdmin ? { creditLimit: creditLimit.trim() !== '' ? Number(creditLimit) : null } : {}),
        },
        s.editClientId,
      )
      if (saved) s.closeModal()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={440}>
      <ModalTitle onClose={s.closeModal}>{s.editClientId ? 'Editar cliente' : 'Nuevo cliente'}</ModalTitle>

      <label style={labelStyle}>Nombre completo</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Laura Pérez"
        autoFocus
        style={inputStyle}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="3001234567"
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <div>
          <label style={labelStyle}>Documento</label>
          <input
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            inputMode="numeric"
            placeholder="CC"
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
      </div>

      {s.isAdmin && (
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Límite de crédito (opcional)</label>
          <input
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            type="number"
            inputMode="decimal"
            placeholder="Sin límite"
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Si el saldo del cliente va a superar este monto al fiarle algo más, se le avisa al cajero antes de confirmar — no bloquea la venta, deja decidir. Vacío = sin límite.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={s.closeModal}
          style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button onClick={save} style={saveBtnStyle(ok)}>
          {s.editClientId ? 'Guardar cambios' : 'Guardar cliente'}
        </button>
      </div>
    </Modal>
  )
}
