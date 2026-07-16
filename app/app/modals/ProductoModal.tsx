'use client'

// Modal de producto (crear / editar) — réplica 1:1 del prototipo (mProd).

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle } from '../ui'

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
}

export default function ProductoModal() {
  const s = useApp()
  const editing = s.editProdId ? s.products.find((p) => p.id === s.editProdId) ?? null : null

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
        }
      : { name: '', sku: '', cat: '', barcode: '', prov: '', price: '', cost: '', stock: '', min: '', photo: null },
  )
  const [suggOpen, setSuggOpen] = useState(false)

  const set = (k: keyof FormState) => (v: string) => setF((st) => ({ ...st, [k]: v }))

  const provVal = f.prov
  const suggs = s.suppliers.filter(
    (pv) => pv.name.toLowerCase().includes(provVal.toLowerCase()) && pv.name !== provVal,
  )
  const suggVisible = suggOpen && suggs.length > 0

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => setF((st) => ({ ...st, photo: String(r.result) }))
    r.readAsDataURL(file)
  }

  const ok = !!f.name && num(f.price) > 0

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
      minStock: num(f.min),
      ...(s.editProdId ? {} : { initialStock: num(f.stock) }),
    }
    const done = await s.saveProduct(payload, s.editProdId)
    if (done) {
      s.setEditProdId(null)
      s.closeModal()
    }
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={470}>
      <ModalTitle onClose={s.closeModal}>{s.editProdId ? 'Editar producto' : 'Nuevo producto'}</ModalTitle>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lblStyle}>SKU (opcional)</label>
          <input value={f.sku} onChange={(e) => set('sku')(e.target.value)} placeholder="RH005" style={fieldStyle} />
        </div>
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

      <label style={lblStyle}>Código de barras (opcional)</label>
      <input
        value={f.barcode}
        onChange={(e) => set('barcode')(e.target.value)}
        inputMode="numeric"
        placeholder="Ej. 7701000000011"
        style={{ ...fieldStyle, fontVariantNumeric: 'tabular-nums' }}
      />

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
          <label style={lblStyle}>Precio de venta $</label>
          <input value={f.price} onChange={(e) => set('price')(e.target.value)} inputMode="numeric" placeholder="0" style={numFieldStyle} />
        </div>
        <div>
          <label style={lblStyle}>Costo $</label>
          <input value={f.cost} onChange={(e) => set('cost')(e.target.value)} inputMode="numeric" placeholder="0" style={numFieldStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lblStyle}>Stock inicial</label>
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
        <div>
          <label style={lblStyle}>Stock mínimo</label>
          <input value={f.min} onChange={(e) => set('min')(e.target.value)} inputMode="numeric" placeholder="0" style={numFieldStyle} />
        </div>
      </div>

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
