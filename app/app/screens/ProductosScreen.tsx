'use client'

// Pantalla de Productos — réplica 1:1 del prototipo (sección sProductos).

import { CSSProperties, useEffect, useState } from 'react'
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
  // "Ver todos" desde el Panel Principal llega con este filtro ya activado;
  // se consume una sola vez y se limpia del store para no quedar pegado.
  const [soloStockBajo, setSoloStockBajo] = useState(() => s.productosFiltroInicial === 'stockBajo')
  useEffect(() => {
    if (s.productosFiltroInicial) s.setProductosFiltroInicial(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const pq = query.trim().toLowerCase()
  const coincide = (p: (typeof s.products)[number]) =>
    !pq ||
    p.name.toLowerCase().includes(pq) ||
    (p.sku ?? '').toLowerCase().includes(pq) ||
    (p.barcode ?? '').includes(pq)

  // Las variantes se listan bajo su producto, no sueltas: la tabla muestra
  // una fila por producto y las variantes se despliegan al tocarla.
  const variantesPorPadre = new Map<string, typeof s.products>()
  for (const p of s.products) {
    if (!p.parentId) continue
    const lista = variantesPorPadre.get(p.parentId) ?? []
    lista.push(p)
    variantesPorPadre.set(p.parentId, lista)
  }

  // Un producto agrupador no tiene stock ni precio propios: se miran los de
  // sus variantes (suma del stock, rango de precios).
  const resumen = (p: (typeof s.products)[number]) => {
    const vs = variantesPorPadre.get(p.id) ?? []
    if (!p.hasVariants || !vs.length) return null
    const precios = vs.map((v) => v.price)
    const min = Math.min(...precios)
    const max = Math.max(...precios)
    return {
      variantes: vs,
      stock: vs.reduce((a, v) => a + v.stock, 0),
      minStock: vs.reduce((a, v) => a + v.minStock, 0),
      precio: min === max ? s.fmt(min) : `${s.fmt(min)} – ${s.fmt(max)}`,
      agotadas: vs.filter((v) => v.stock <= 0).length,
    }
  }

  const bajoStock = (p: (typeof s.products)[number]) => {
    const g = resumen(p)
    const stock = g ? g.stock : p.stock
    const minStock = g ? g.minStock : p.minStock
    return p.status === 'ACTIVE' && (stock <= 0 || (minStock > 0 && stock <= minStock))
  }

  const rows = s.products
    .filter((p) => !p.parentId)
    .filter((p) => {
      if (coincide(p)) return true
      // buscar también dentro de las variantes: "RH005" debe encontrar su grupo
      return (variantesPorPadre.get(p.id) ?? []).some(coincide)
    })
    .filter((p) => !catId || p.category?.id === catId)
    .filter((p) => !soloStockBajo || bajoStock(p))

  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
        <button
          onClick={() => setSoloStockBajo((v) => !v)}
          style={{
            height: 38,
            padding: '0 14px',
            borderRadius: 12,
            border: soloStockBajo ? '1.5px solid transparent' : '1.5px solid var(--border)',
            background: soloStockBajo ? '#FDECEC' : 'var(--surface)',
            color: soloStockBajo ? '#C9433B' : 'var(--text)',
            fontSize: 14.5,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {soloStockBajo ? '✕ Solo stock bajo' : 'Solo stock bajo'}
        </button>
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
            const grupo = resumen(p)
            const abierto = abiertos.has(p.id)
            return (
              <div key={p.id}>
              <div
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
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.name}
                      {grupo && (
                        <button
                          onClick={() => alternar(p.id)}
                          className="v-hover-bg"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', borderRadius: 7, background: '#EEF0FE', color: '#4338CA', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
                        >
                          {grupo.variantes.length} variantes
                          <span style={{ display: 'flex', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                            <Icono n="chevron" tam={11} grosor={2.4} />
                          </span>
                        </button>
                      )}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>
                      {grupo
                        ? `${grupo.agotadas ? `${grupo.agotadas} agotada${grupo.agotadas === 1 ? '' : 's'} · ` : ''}${p.supplier ?? '—'}`
                        : `SKU: ${p.sku ?? '—'} · ${p.supplier ?? '—'}`}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '13px 10px' }}>
                  <span style={catChipStyle(p.category?.name ?? '—')}>{p.category?.name ?? '—'}</span>
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontWeight: 700, fontSize: grupo ? 12.5 : 14, fontVariantNumeric: 'tabular-nums' }}>
                  {grupo ? grupo.precio : s.fmt(p.price)}
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.isAdmin ? s.fmt(p.cost ?? 0) : '—'}
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right' }}>
                  {grupo ? (
                    <span style={grupo.stock <= 0 ? stockLowStyle : stockOkStyle}>
                      {p.unitOfMeasure === 'kg' ? `${fmtQty(grupo.stock)} kg` : grupo.stock}
                    </span>
                  ) : (
                    <span style={p.stock <= p.minStock ? stockLowStyle : stockOkStyle}>
                      {p.unitOfMeasure === 'kg' ? `${fmtQty(p.stock)} kg` : p.stock}
                    </span>
                  )}
                </div>
                <div style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {grupo ? '—' : p.minStock}
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

              {grupo && abierto && (
                <div style={{ background: 'var(--bg)', borderBottom: '1px solid #EEF2F7' }}>
                  {grupo.variantes.map((v) => (
                    <div
                      key={v.id}
                      style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '0 10px' }}
                    >
                      <div style={{ padding: '9px 10px 9px 58px', display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.3 }}>{v.variantLabel}</span>
                        <span style={{ color: 'var(--muted)', fontSize: 12.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          SKU: {v.sku ?? '—'}
                        </span>
                      </div>
                      <div />
                      <div style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13.3, fontVariantNumeric: 'tabular-nums' }}>
                        {s.fmt(v.price)}
                      </div>
                      <div style={{ padding: '9px 10px', textAlign: 'right', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {s.isAdmin ? s.fmt(v.cost ?? 0) : '—'}
                      </div>
                      <div style={{ padding: '9px 10px', textAlign: 'right' }}>
                        <span style={v.stock <= v.minStock ? stockLowStyle : stockOkStyle}>
                          {v.unitOfMeasure === 'kg' ? `${fmtQty(v.stock)} kg` : v.stock}
                        </span>
                      </div>
                      <div style={{ padding: '9px 10px', textAlign: 'right', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {v.minStock}
                      </div>
                      <div style={{ padding: '9px 10px', textAlign: 'right', display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                        <button
                          className="v-hover-underline"
                          onClick={() => {
                            s.setEditProdId(v.id)
                            s.openModal('producto')
                          }}
                          style={{ color: '#6366F1', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                        >
                          Editar
                        </button>
                        <button
                          className="v-hover-danger"
                          onClick={() => s.archiveProduct(v.id)}
                          style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                        >
                          Archivar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
