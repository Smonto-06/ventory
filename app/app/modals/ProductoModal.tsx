'use client'

// Modal de producto (crear / editar) — réplica 1:1 del prototipo (mProd).

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle, parseQty } from '../ui'
import EditorVariantes, { type FilaVariante, type OpcionVariante } from './variantes'

const num = (v: string | number | null | undefined) =>
  parseInt(String(v ?? '').replace(/\D/g, '')) || 0

const fieldStyle: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 14.5,
}

const numFieldStyle: CSSProperties = {
  ...fieldStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const lblStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '10px 0 5px',
}

interface FormState {
  name: string
  sku: string
  cat: string
  barcode: string
  prov: string
  price: string
  cost: string
  stock: string
  min: string
  photo: string | null
  /** 'und' = por unidad · 'kg' = por peso (precio por kilo) */
  unit: 'und' | 'kg'
}

export default function ProductoModal() {
  const s = useApp()
  const editing = s.editProdId ? s.products.find((p) => p.id === s.editProdId) ?? null : null
  // Variantes ya creadas de este producto (solo al editar un agrupador)
  const variantesActuales = editing ? s.products.filter((p) => p.parentId === editing.id) : []
  const esAgrupador = !!editing?.hasVariants
  const esVariante = !!editing?.parentId

  const [f, setF] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          sku: editing.sku ?? '',
          cat: editing.category?.id ?? '',
          barcode: editing.barcode ?? '',
          prov: editing.supplier ?? '',
          price: String(editing.price),
          cost: String(editing.cost ?? ''),
          stock: String(editing.stock),
          min: String(editing.minStock),
          photo: editing.imageUrl ?? null,
          unit: editing.unitOfMeasure === 'kg' ? 'kg' : 'und',
        }
      : { name: '', sku: '', cat: '', barcode: '', prov: '', price: '', cost: '', stock: '', min: '', photo: null, unit: 'und' },
  )
  const [suggOpen, setSuggOpen] = useState(false)

  // ── Variantes ──
  // Al crear: se marca la casilla y se definen las opciones.
  // Al editar un agrupador: siempre visible, para sumar combinaciones nuevas.
  const [conVariantes, setConVariantes] = useState(false)
  // Al editar un agrupador se parte de sus opciones ya definidas, con los
  // valores vacíos: así se agrega "talla XL" sin volver a escribir "Talla".
  const [opciones, setOpciones] = useState<OpcionVariante[]>(() => {
    const previas = editing?.hasVariants ? editing.variantOptions : null
    if (previas?.length) return previas.map((o) => ({ nombre: o.nombre, valores: [] }))
    return [{ nombre: '', valores: [] }]
  })
  const [filas, setFilas] = useState<FilaVariante[]>([])
  const variantesVisibles = (conVariantes && !s.editProdId) || esAgrupador

  const set = (k: keyof FormState) => (v: string) => setF((st) => ({ ...st, [k]: v }))

  const provVal = f.prov
  const suggs = s.suppliers.filter(
    (pv) => pv.name.toLowerCase().includes(provVal.toLowerCase()) && pv.name !== provVal,
  )
  const suggVisible = suggOpen && suggs.length > 0

  // La foto se comprime en el navegador (máx. 320px, JPEG 72%) antes de
  // guardarse: pasa de varios MB a ~15-30 KB y la base de datos gratuita rinde.
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 320
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const compressed = canvas.toDataURL('image/jpeg', 0.72)
      URL.revokeObjectURL(url)
      setF((st) => ({ ...st, photo: compressed }))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      s.toast('No se pudo leer la imagen')
    }
    img.src = url
  }

  const ok =
    !!f.name &&
    num(f.price) > 0 &&
    (!variantesVisibles || esAgrupador || filas.length > 0)

  const save = async () => {
    if (!f.name) return s.toast('Escribe el nombre del producto')
    if (num(f.price) <= 0) return s.toast('El precio de venta debe ser mayor a 0')
    const payload: Record<string, unknown> = {
      name: f.name,
      sku: f.sku.trim().toUpperCase() || null,
      barcode: f.barcode.trim() || null,
      price: num(f.price),
      cost: num(f.cost),
      categoryId: f.cat || null,
      supplier: f.prov.trim() || null,
      imageUrl: f.photo,
      unitOfMeasure: f.unit === 'kg' ? 'kg' : null,
      minStock: f.unit === 'kg' ? parseQty(f.min) : num(f.min),
      ...(s.editProdId ? {} : { initialStock: f.unit === 'kg' ? parseQty(f.stock) : num(f.stock) }),
    }
    // Producto nuevo con variantes: se manda todo junto y el servidor crea el
    // agrupador y cada combinación en una sola transacción.
    if (variantesVisibles && !s.editProdId) {
      if (!filas.length) return s.toast('Agrega al menos una variante')
      payload.variantOptions = opciones
        .filter((o) => o.nombre.trim() && o.valores.length)
        .map((o) => ({ nombre: o.nombre.trim(), valores: o.valores }))
      payload.variantes = filas.map((v) => ({
        label: v.label,
        sku: v.sku.trim().toUpperCase() || null,
        barcode: v.barcode.trim() || null,
        ...(num(v.price) > 0 ? { price: num(v.price) } : {}),
        initialStock: f.unit === 'kg' ? parseQty(v.stock) : num(v.stock),
        minStock: f.unit === 'kg' ? parseQty(f.min) : num(f.min),
      }))
      delete payload.initialStock
      delete payload.sku
      delete payload.barcode
    }

    const done = await s.saveProduct(payload, s.editProdId)
    if (!done) return

    // Al editar un agrupador, las combinaciones nuevas se agregan aparte
    if (esAgrupador && filas.length) {
      const agregado = await s.addVariants(s.editProdId!, {
        variantOptions: opciones
          .filter((o) => o.nombre.trim() && o.valores.length)
          .map((o) => ({ nombre: o.nombre.trim(), valores: o.valores })),
        variantes: filas.map((v) => ({
          label: v.label,
          sku: v.sku.trim().toUpperCase() || null,
          barcode: v.barcode.trim() || null,
          ...(num(v.price) > 0 ? { price: num(v.price) } : {}),
          initialStock: f.unit === 'kg' ? parseQty(v.stock) : num(v.stock),
          minStock: f.unit === 'kg' ? parseQty(f.min) : num(f.min),
        })),
      })
      if (!agregado) return
    }

    s.setEditProdId(null)
    s.closeModal()
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={variantesVisibles ? 560 : 470}>
      <ModalTitle onClose={s.closeModal}>{s.editProdId ? 'Editar producto' : 'Nuevo producto'}</ModalTitle>

      {esVariante && (
        <div style={{ marginTop: 14, background: '#EEF0FE', border: '1px solid #C7D0FB', borderRadius: 11, padding: '11px 14px', fontSize: 12.8, color: '#4338CA', lineHeight: 1.55 }}>
          Estás editando la variante <b>{editing?.variantLabel}</b>. Su precio, stock y códigos son
          propios; el nombre general se cambia desde el producto principal.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 11,
            overflow: 'hidden',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 13,
            color: 'var(--muted)',
            ...(f.photo
              ? { backgroundImage: `url(${f.photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: '#EEF2F7' }),
          }}
        >
          {f.photo ? '' : 'Foto'}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 40,
              padding: '0 14px',
              borderRadius: 10,
              background: '#EEF0FE',
              color: '#4338CA',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Subir foto
            <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
          </label>
          {f.photo && (
            <button
              className="v-hover-underline"
              onClick={() => setF((st) => ({ ...st, photo: null }))}
              style={{ fontSize: 13, color: '#C9433B', fontWeight: 600, cursor: 'pointer' }}
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>

      <label style={{ ...lblStyle, margin: '11px 0 5px' }}>Nombre</label>
      <input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Ej. Camiseta Estampada M" style={fieldStyle} />

      {!s.editProdId && (
        <button
          onClick={() => {
            const v = !conVariantes
            setConVariantes(v)
            if (!v) setFilas([])
          }}
          style={{
            marginTop: 11,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '11px 13px',
            borderRadius: 11,
            border: `1.5px solid ${conVariantes ? '#6366F1' : 'var(--border)'}`,
            background: conVariantes ? '#EEF0FE' : 'var(--surface)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: conVariantes ? '#6366F1' : 'var(--input)',
              border: conVariantes ? 'none' : '1.5px solid var(--border)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {conVariantes ? '✓' : ''}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>
              Tiene variantes (talla, color…)
            </span>
            <span style={{ display: 'block', fontSize: 12.3, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
              Cada combinación lleva su propio inventario
            </span>
          </span>
        </button>
      )}

      <label style={lblStyle}>Se vende por</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {([['und', 'Unidad'], ['kg', 'Peso (kg)']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setF((st) => ({ ...st, unit: k }))}
            style={{
              flex: 1, height: 40, borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', transition: 'all .13s',
              border: f.unit === k ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
              background: f.unit === k ? '#6366F1' : 'var(--surface)',
              color: f.unit === k ? '#fff' : 'var(--text)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {f.unit === 'kg' && (
        <div style={{ marginTop: 6, fontSize: 12.5, color: '#94A3B8' }}>
          El precio de venta y el costo son por kilogramo. Al vender se digita el peso.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: variantesVisibles ? '1fr' : '1fr 1fr', gap: 12 }}>
        {!variantesVisibles && (
        <div>
          <label style={lblStyle}>SKU (opcional)</label>
          <input value={f.sku} onChange={(e) => set('sku')(e.target.value)} placeholder="RH005" style={fieldStyle} />
        </div>
        )}
        <div>
          <label style={lblStyle}>Categoría</label>
          <select
            value={f.cat}
            onChange={(e) => set('cat')(e.target.value)}
            style={{ ...fieldStyle, padding: '0 12px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
          >
            <option value="">Selecciona…</option>
            {s.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!variantesVisibles && (
        <>
          <label style={lblStyle}>Código de barras (opcional)</label>
          <input
            value={f.barcode}
            onChange={(e) => set('barcode')(e.target.value)}
            inputMode="numeric"
            placeholder="Ej. 7701000000011"
            style={{ ...fieldStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </>
      )}

      <label style={lblStyle}>Proveedor</label>
      <div style={{ position: 'relative' }}>
        <input
          value={f.prov}
          onChange={(e) => {
            set('prov')(e.target.value)
            setSuggOpen(true)
          }}
          onFocus={() => setSuggOpen(true)}
          onBlur={() => setTimeout(() => setSuggOpen(false), 150)}
          placeholder="Escribe el nombre del proveedor…"
          style={fieldStyle}
        />
        {suggVisible && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 11,
              boxShadow: '0 14px 30px -14px rgba(15,25,23,.35)',
              zIndex: 10,
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {suggs.map((pv) => (
              <button
                key={pv.id}
                className="v-hover-bg"
                onMouseDown={() => {
                  setF((st) => ({ ...st, prov: pv.name }))
                  setSuggOpen(false)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--bg)',
                  background: 'var(--surface)',
                }}
              >
                {pv.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lblStyle}>{f.unit === 'kg' ? 'Precio por kg $' : 'Precio de venta $'}</label>
          <input value={f.price} onChange={(e) => set('price')(e.target.value)} inputMode="numeric" placeholder="0" style={numFieldStyle} />
        </div>
        <div>
          <label style={lblStyle}>{f.unit === 'kg' ? 'Costo por kg $' : 'Costo $'}</label>
          <input value={f.cost} onChange={(e) => set('cost')(e.target.value)} inputMode="numeric" placeholder="0" style={numFieldStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: variantesVisibles ? '1fr' : '1fr 1fr', gap: 12 }}>
        {!variantesVisibles && (
        <div>
          <label style={lblStyle}>{f.unit === 'kg' ? 'Stock inicial (kg)' : 'Stock inicial'}</label>
          <input
            value={f.stock}
            onChange={(e) => set('stock')(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            disabled={!!s.editProdId}
            title={s.editProdId ? 'El stock se modifica con compras o ajustes de inventario' : undefined}
            style={{ ...numFieldStyle, ...(s.editProdId ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
          />
        </div>
        )}
        <div>
          <label style={lblStyle}>{f.unit === 'kg' ? 'Stock mínimo (kg)' : 'Stock mínimo'}</label>
          <input value={f.min} onChange={(e) => set('min')(e.target.value)} inputMode="numeric" placeholder="0" style={numFieldStyle} />
        </div>
      </div>

      {variantesVisibles && (
        <>
          {esAgrupador && variantesActuales.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 7 }}>
                Variantes actuales ({variantesActuales.length})
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {variantesActuales.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => s.setEditProdId(v.id)}
                    className="v-hover-bg"
                    title="Editar esta variante"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12.8, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {v.variantLabel}
                    <span style={{ color: v.stock <= 0 ? '#C9433B' : 'var(--muted)', fontWeight: 700 }}>
                      {v.unitOfMeasure === 'kg' ? `${v.stock} kg` : v.stock}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <EditorVariantes
            opciones={opciones}
            setOpciones={setOpciones}
            filas={filas}
            setFilas={setFilas}
            precioBase={f.price}
            porPeso={f.unit === 'kg'}
            soloNuevas={esAgrupador}
            etiquetasExistentes={variantesActuales.map((v) => v.variantLabel ?? '')}
          />
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
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
        <button className={ok ? 'v-hover-primary' : undefined} onClick={save} style={saveBtnStyle(ok)}>
          {s.editProdId ? 'Guardar cambios' : 'Guardar producto'}
        </button>
      </div>
    </Modal>
  )
}
