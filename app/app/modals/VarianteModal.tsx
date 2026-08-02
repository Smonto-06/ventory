'use client'

// Selector de variante en el punto de venta.
//
// Al tocar un producto con variantes se abre esta lista para elegir cuál se
// vende. Los botones son grandes a propósito: en el mostrador se usa con el
// dedo y muchas veces de afán. Las agotadas se muestran deshabilitadas en vez
// de esconderse, para que el cajero vea que existen pero no hay.

import { useApp } from '../store'
import { Modal, ModalTitle, fmtQty } from '../ui'

export default function VarianteModal() {
  const s = useApp()
  const padre = s.varianteProduct
  if (!padre) return null

  const variantes = s.products
    .filter((p) => p.parentId === padre.id && p.status === 'ACTIVE')
    .sort((a, b) => (a.variantLabel ?? '').localeCompare(b.variantLabel ?? '', 'es', { numeric: true }))

  const disponibles = variantes.filter((v) => v.stock > 0).length

  return (
    <Modal onClose={s.closeModal} maxWidth={430}>
      <ModalTitle onClose={s.closeModal}>{padre.name}</ModalTitle>
      <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)' }}>
        Elige la variante que se lleva el cliente
        {variantes.length > 0 && ` · ${disponibles} de ${variantes.length} con existencias`}
      </div>

      {variantes.length === 0 ? (
        <div style={{ marginTop: 18, padding: '18px 16px', borderRadius: 12, background: 'var(--bg)', fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
          Este producto todavía no tiene variantes activas.
        </div>
      ) : (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, maxHeight: '52vh', overflowY: 'auto' }}>
          {variantes.map((v) => {
            const agotada = v.stock <= 0
            return (
              <button
                key={v.id}
                disabled={agotada}
                onClick={() => {
                  s.closeModal()
                  s.addToCart(v)
                }}
                className={agotada ? undefined : 'v-hover-lift'}
                style={{
                  textAlign: 'left',
                  padding: '13px 14px',
                  borderRadius: 12,
                  border: `1.5px solid ${agotada ? 'var(--border)' : '#DDE2FB'}`,
                  background: agotada ? 'var(--bg)' : 'var(--surface)',
                  cursor: agotada ? 'not-allowed' : 'pointer',
                  opacity: agotada ? 0.55 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  minHeight: 78,
                  transition: 'all .13s',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.2px' }}>{v.variantLabel}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>
                  {s.fmt(v.price)}
                </span>
                <span style={{ fontSize: 12, color: agotada ? '#C9433B' : 'var(--muted)', fontWeight: 600 }}>
                  {agotada
                    ? 'Agotada'
                    : `${v.unitOfMeasure === 'kg' ? `${fmtQty(v.stock)} kg` : v.stock} disponibles`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={s.closeModal}
        style={{ marginTop: 18, width: '100%', height: 46, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
      >
        Cancelar
      </button>
    </Modal>
  )
}
