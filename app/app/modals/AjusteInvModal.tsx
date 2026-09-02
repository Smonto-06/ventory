'use client'

// Modal de ajuste de inventario — réplica 1:1 del prototipo (mAjuste).

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, parseQty } from '../ui'
import CampoNumerico from './CampoNumerico'

const num = (v: string) => parseInt(String(v || '').replace(/\D/g, '')) || 0

export default function AjusteInvModal() {
  const s = useApp()
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState<Record<string, string>>({})

  const q = search.trim().toLowerCase()
  const rows = s.products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q),
  )

  const isKg = (productId: string) => s.products.find((p) => p.id === productId)?.unitOfMeasure === 'kg'

  const apply = () => {
    const out: Record<string, number> = {}
    Object.entries(qty).forEach(([id, v]) => {
      if (v === '') return
      out[id] = isKg(id) ? parseQty(v) : num(v)
    })
    if (!Object.keys(out).length) return
    s.applyAjuste(out)
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={460}>
      <ModalTitle onClose={s.closeModal}>Ajuste de inventario</ModalTitle>

      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
        Ingresa el conteo físico solo en los productos que quieras corregir:
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o código de barras…"
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 11,
          background: 'var(--input)',
          fontSize: 14,
          marginTop: 10,
          flex: 'none',
        }}
      />
      <div style={{ marginTop: 10, maxHeight: '48vh', overflowY: 'auto', border: '1px solid #EEF2F7', borderRadius: 12 }}>
        {rows.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 90px',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--bg)',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>{p.name}</span>
            <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              Stock {p.stock}
            </span>
            <CampoNumerico
              value={qty[p.id] ?? ''}
              onChange={(raw) => {
                const v = isKg(p.id) ? String(parseQty(raw)) : raw.replace(/\D/g, '')
                setQty((st) => ({ ...st, [p.id]: v }))
              }}
              decimales={isKg(p.id)}
              placeholder="—"
              titulo={`Conteo físico — ${p.name}`}
              ariaLabel={`Conteo físico de ${p.name}`}
              style={{
                height: 36,
                border: '1.5px solid var(--border)',
                borderRadius: 9,
                background: 'var(--input)',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 13.5,
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
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
        <button
          className="v-hover-primary"
          onClick={apply}
          style={{
            flex: 1.4,
            height: 48,
            borderRadius: 12,
            background: '#6366F1',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14.5,
            cursor: 'pointer',
            boxShadow: '0 8px 18px -8px #6366F1cc',
          }}
        >
          Aplicar ajuste
        </button>
      </div>
    </Modal>
  )
}
