'use client'

// Datos de la cotización antes de emitirla: a quién, por cuántos días y con
// qué nota. El cliente es lo único que de verdad importa —una cotización sin
// destinatario no sirve para nada— pero se permite escribirlo libre, porque en
// el mostrador casi nunca está en el catálogo todavía.

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle } from '../ui'

const campo: CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 14.5,
}

const etiqueta: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '12px 0 5px',
}

const DIAS = [3, 8, 15, 30]

export default function CotizarModal() {
  const s = useApp()
  const [nombre, setNombre] = useState(s.customerName)
  const [dias, setDias] = useState(8)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const clienteCatalogo = s.customers.find(
    (c) => c.name.trim().toLowerCase() === nombre.trim().toLowerCase(),
  )

  const vence = new Date()
  vence.setDate(vence.getDate() + dias)

  const ok = s.cart.length > 0 && !!nombre.trim()

  const emitir = async () => {
    if (!ok || guardando) return
    setGuardando(true)
    await s.crearCotizacion({
      customerId: clienteCatalogo?.id ?? null,
      customerName: clienteCatalogo ? undefined : nombre,
      notes: nota,
      validDays: dias,
    })
    setGuardando(false)
    s.closeModal()
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={430}>
      <ModalTitle onClose={s.closeModal}>Cotizar</ModalTitle>
      <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>
        Se guarda el precio de hoy sin descontar inventario. Cuando el cliente
        vuelva, la conviertes en venta con un toque.
      </div>

      <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 12, padding: '13px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--muted)' }}>
          <span>
            {s.itemCount} {s.itemCount === 1 ? 'artículo' : 'artículos'}
          </span>
          <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {s.fmt(s.total)}
          </span>
        </div>
      </div>

      <label style={etiqueta}>Cliente</label>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de quien pide la cotización"
        list="cot-clientes"
        style={campo}
      />
      <datalist id="cot-clientes">
        {s.customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      {clienteCatalogo && (
        <div style={{ marginTop: 5, fontSize: 12.3, color: '#0F8A5F', fontWeight: 600 }}>
          Cliente del catálogo: queda ligada a su historial
        </div>
      )}

      <label style={etiqueta}>Válida por</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DIAS.map((d) => (
          <button
            key={d}
            onClick={() => setDias(d)}
            style={{
              flex: 1,
              minWidth: 66,
              height: 40,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              border: dias === d ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
              background: dias === d ? '#6366F1' : 'var(--surface)',
              color: dias === d ? '#fff' : 'var(--text)',
            }}
          >
            {d} días
          </button>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 12.3, color: 'var(--muted)' }}>
        Se respeta el precio hasta el{' '}
        <b>{vence.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</b>
      </div>

      <label style={etiqueta}>Nota (opcional)</label>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Ej. Entrega en 3 días hábiles"
        style={campo}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={s.closeModal}
          style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button className={ok ? 'v-hover-primary' : undefined} onClick={emitir} style={saveBtnStyle(ok && !guardando)}>
          {guardando ? 'Emitiendo…' : 'Emitir cotización'}
        </button>
      </div>
    </Modal>
  )
}
