'use client'

// Pantalla de Productos — réplica 1:1 del prototipo (sección sProductos).

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { catChipStyle, tileFor, fmtQty } from '../ui'
import { Icono } from '@/components/Icono'

const gridCols = 'minmax(220px,1.8fr) minmax(120px,1fr) 110px 110px 70px 60px 140px'

const thStyle: CSSProperties = {
  padding: '12px 10px',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
}

const stockLowStyle: CSSProperties = {
  display: 'inline-block',
  minWidth: 34,
  textAlign: 'center',
  padding: '3px 8px',
  borderRadius: 8,
  background: '#FDECEC',
  color: '#C9433B',
  fontWeight: 800,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
}

const stockOkStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  fontVariantNumeric: 'tabular-nums',
}

const toolBtnStyle: CSSProperties = {
  height: 44,
  padding: '0 14px',
  borderRadius: 11,
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
}

export default function ProductosScreen() {
  const s = useApp()
  const [query, setQuery] = useState('')
  const [catId, setCatId] = useState('')

  const pq = query.trim().toLowerCase()
  const rows = s.products
    .filter(
      (p) =>
        !pq ||
        p.name.toLowerCase().includes(pq) ||
        (p.sku ?? '').toLowerCase().includes(pq) ||
        (p.barcode ?? '').includes(pq),
    )
    .filter((p) => !catId || p.category?.id === catId)

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Productos</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {s.isAdmin && (
            <>
              <button className="v-hover-bg" onClick={() => s.openModal('ajusteinv')} style={toolBtnStyle}>
                Ajuste de inventario
              </button>
              <button className="v-hover-bg" onClick={() => s.openModal('traslado')} style={toolBtnStyle}>
                Traslado
              </button>
            </>
          )}
          <button className="v-hover-bg" onClick={() => s.openModal('categorias')} style={{ ...toolBtnStyle, padding: '0 16px' }}>
            Categorías
          </button>
          {s.isAdmin && (
            <button
              className="v-hover-bg"
              onClick={() => s.openModal('importar')}
              style={{ height: 44, padding: '0 16px', borderRadius: 11, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Icono n="subida" tam={15} />
              Importar
            </button>
          )}
          <button
            className="v-hover-primary"
            onClick={() => {
              s.setEditProdId(null)
              s.openModal('producto')
            }}
            style={{
              height: 44,
              padding: '0 18px',
              borderRadius: 11,
              background: '#6366F1',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14.5,
              cursor: 'pointer',
              boxShadow: '0 8px 18px -8px #6366F1cc',
            }}
          >
            + Nuevo producto
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, SKU o código de barras…"
          style={{
            flex: 1,
            minWidth: 'min(100%,240px)',
            height: 46,
            padding: '0 16px',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
            fontSize: 14.5,
          }}
        />
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          style={{
            height: 38,
            padding: '0 14px',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
            fontSize: 14.5,
            fontWeight: 600,
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <option value="">Todas las categorías</option>
          {s.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 840 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              alignItems: 'center',
              background: 'var(--surface2)',
              borderBottom: '1px solid #EEF2F7',
              padding: '0 10px',
            }}
          >
            <div style={thStyle}>Nombre</div>
            <div style={thStyle}>Categoría</div>
            <div style={{ ...thStyle, textAlign: 'right' }}>Precio</div>
            <div style={{ ...thStyle, textAlign: 'right' }}>Costo</div>
            <div style={{ ...thStyle, textAlign: 'right' }}>Stock</div>
            <div style={{ ...thStyle, textAlign: 'right' }}>Mín.</div>
            <div />
          </div>
          {rows.map((p) => {
            const { tileStyle, tileText, tileFg } = tileFor(p)
            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  alignItems: 'center',
                  borderBottom: '1px solid #EEF2F7',
                  padding: '0 10px',
                }}
              >
                <div style={{ padding: '13px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 9,
                      flex: 'none',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 12,
                      color: tileFg,
                      ...tileStyle,
                    }}
                  >
                    {tileText}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>
                      SKU: {p.sku ?? '—'} · {p.supplier ?? '—'}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '13px 10px' }}>
                  <span style={catChipStyle(p.category?.name ?? '—')}>{p.category?.name ?? '—'}</span>
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  {s.fmt(p.price)}
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.isAdmin ? s.fmt(p.cost ?? 0) : '—'}
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right' }}>
                  <span style={p.stock <= p.minStock ? stockLowStyle : stockOkStyle}>{p.unitOfMeasure === 'kg' ? `${fmtQty(p.stock)} kg` : p.stock}</span>
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.minStock}
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                  <button
                    className="v-hover-underline"
                    onClick={() => {
                      s.setEditProdId(p.id)
                      s.openModal('producto')
                    }}
                    style={{ color: '#6366F1', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                  <button
                    className="v-hover-danger"
                    onClick={() => s.archiveProduct(p.id)}
                    style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
                  >
                    Archivar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
