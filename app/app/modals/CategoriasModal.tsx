'use client'

// Modal de categorías — réplica 1:1 del prototipo (mCats).

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle } from '../ui'

export default function CategoriasModal() {
  const s = useApp()
  const [newCat, setNewCat] = useState('')

  const rows = s.categories.map((c) => {
    const count = s.products.filter((p) => p.category?.id === c.id).length
    return { ...c, count, countStr: `${count} ${count === 1 ? 'producto' : 'productos'}` }
  })

  const canAdd = !!newCat.trim()

  const addCat = async () => {
    const v = newCat.trim()
    if (!v || s.categories.some((c) => c.name.toLowerCase() === v.toLowerCase())) return
    await s.addCategory(v)
    setNewCat('')
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={420}>
      <ModalTitle onClose={s.closeModal}>Categorías</ModalTitle>

      <div style={{ marginTop: 14, border: '1px solid #EEF2F7', borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--bg)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{c.countStr}</div>
            </div>
            {c.count === 0 && (
              <button
                onClick={() => s.deleteCategory(c.id)}
                title="Eliminar categoría"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: '#FDECEC',
                  color: '#C9433B',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Nueva categoría…"
          style={{
            flex: 1,
            height: 38,
            padding: '0 14px',
            border: '1.5px solid var(--border)',
            borderRadius: 11,
            background: 'var(--input)',
            fontSize: 14.5,
          }}
        />
        <button className={canAdd ? 'v-hover-primary' : undefined} onClick={addCat} style={saveBtnStyle(canAdd)}>
          Agregar
        </button>
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
        Solo se pueden eliminar categorías sin productos.
      </div>
    </Modal>
  )
}
