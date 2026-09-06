'use client'

// Modal de traslado de productos — réplica 1:1 del prototipo (mTraslado).

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle, parseQty } from '../ui'
import CampoNumerico from './CampoNumerico'

const lblStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '10px 0 5px',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 14.5,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
}

export default function TrasladoModal() {
  const s = useApp()
  const [prodId, setProdId] = useState('')
  const [qty, setQty] = useState(0)
  const [dir, setDir] = useState<'out' | 'in'>('out')
  const porPeso = s.products.find((p) => p.id === prodId)?.unitOfMeasure === 'kg'

  const ok = !!prodId && qty > 0

  const doTraslado = () => {
    if (!ok) return
    s.doTraslado(prodId, qty, dir)
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={400}>
      <ModalTitle onClose={s.closeModal}>Traslado de productos</ModalTitle>

      <label style={{ ...lblStyle, margin: '11px 0 5px' }}>Producto</label>
      <select value={prodId} onChange={(e) => setProdId(e.target.value)} style={selectStyle}>
        <option value="">Selecciona…</option>
        {s.products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lblStyle}>{porPeso ? 'Cantidad (kg)' : 'Cantidad'}</label>
          <CampoNumerico
            value={qty || ''}
            onChange={(raw) => setQty(porPeso ? parseQty(raw) : parseInt(raw.replace(/\D/g, '')) || 0)}
            decimales={porPeso}
            titulo={porPeso ? 'Cantidad a trasladar (kg)' : 'Cantidad a trasladar'}
            style={{
              width: '100%',
              height: 38,
              padding: '0 14px',
              border: '1.5px solid var(--border)',
              borderRadius: 11,
              background: 'var(--input)',
              fontSize: 15,
              fontWeight: 700,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        </div>
        <div>
          <label style={lblStyle}>Dirección</label>
          <select value={dir} onChange={(e) => setDir(e.target.value as 'out' | 'in')} style={{ ...selectStyle, fontSize: 14 }}>
            <option value="out">Salida a otra sucursal</option>
            <option value="in">Entrada desde otra sucursal</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={s.closeModal}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: 14.5,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button className={ok ? 'v-hover-primary' : undefined} onClick={doTraslado} style={saveBtnStyle(ok)}>
          Registrar traslado
        </button>
      </div>
    </Modal>
  )
}
