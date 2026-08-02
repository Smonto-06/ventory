'use client'

// Editor de variantes: se define una o dos opciones (Talla, Color…) con sus
// valores, y el sistema arma todas las combinaciones. Cada combinación es un
// producto vendible, así que se le puede poner su propio stock, precio, SKU y
// código de barras sin salir de aquí.

import { CSSProperties, useMemo, useState } from 'react'
import { Icono } from '@/components/Icono'

export interface FilaVariante {
  label: string
  stock: string
  price: string
  sku: string
  barcode: string
}

export interface OpcionVariante {
  nombre: string
  valores: string[]
}

const SUGERENCIAS: Array<{ nombre: string; valores: string[] }> = [
  { nombre: 'Talla', valores: ['S', 'M', 'L', 'XL'] },
  { nombre: 'Talla (calzado)', valores: ['36', '37', '38', '39', '40', '41', '42'] },
  { nombre: 'Color', valores: ['Negro', 'Blanco', 'Azul', 'Rojo'] },
  { nombre: 'Presentación', valores: ['Pequeño', 'Mediano', 'Grande'] },
]

const campo: CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  border: '1.5px solid var(--border)',
  borderRadius: 9,
  background: 'var(--input)',
  fontSize: 13.5,
}

const campoNum: CSSProperties = { ...campo, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

/** Combinaciones de todas las opciones: [[S,M],[Azul,Negro]] → "S / Azul", … */
export function combinar(opciones: OpcionVariante[]): string[] {
  const limpias = opciones.map((o) => o.valores.map((v) => v.trim()).filter(Boolean)).filter((v) => v.length > 0)
  if (!limpias.length) return []
  return limpias.reduce<string[]>(
    (acc, valores) => acc.flatMap((base) => valores.map((v) => (base ? `${base} / ${v}` : v))),
    [''],
  )
}

export default function EditorVariantes({
  opciones,
  setOpciones,
  filas,
  setFilas,
  precioBase,
  porPeso,
  soloNuevas,
  etiquetasExistentes = [],
}: {
  opciones: OpcionVariante[]
  setOpciones: (o: OpcionVariante[]) => void
  filas: FilaVariante[]
  setFilas: (f: FilaVariante[]) => void
  precioBase: string
  porPeso: boolean
  /** true cuando se agregan variantes a un producto que ya las tiene */
  soloNuevas?: boolean
  etiquetasExistentes?: string[]
}) {
  const [valorNuevo, setValorNuevo] = useState<Record<number, string>>({})

  const yaHay = useMemo(
    () => new Set(etiquetasExistentes.map((e) => e.toLowerCase())),
    [etiquetasExistentes],
  )

  const regenerar = (nuevasOpciones: OpcionVariante[]) => {
    setOpciones(nuevasOpciones)
    const combos = combinar(nuevasOpciones).filter((c) => !yaHay.has(c.toLowerCase()))
    // se conserva lo ya escrito para las combinaciones que sobreviven
    const previas = new Map(filas.map((f) => [f.label, f]))
    setFilas(combos.map((c) => previas.get(c) ?? { label: c, stock: '', price: '', sku: '', barcode: '' }))
  }

  const setOpcion = (i: number, parche: Partial<OpcionVariante>) => {
    const copia = opciones.map((o, j) => (j === i ? { ...o, ...parche } : o))
    regenerar(copia)
  }

  const agregarValor = (i: number) => {
    const v = (valorNuevo[i] ?? '').trim()
    if (!v) return
    if (opciones[i].valores.some((x) => x.toLowerCase() === v.toLowerCase())) return
    setOpcion(i, { valores: [...opciones[i].valores, v] })
    setValorNuevo((st) => ({ ...st, [i]: '' }))
  }

  const setFila = (i: number, parche: Partial<FilaVariante>) =>
    setFilas(filas.map((f, j) => (j === i ? { ...f, ...parche } : f)))

  const duplicadas = filas.filter((f) => yaHay.has(f.label.toLowerCase())).length

  return (
    <div style={{ marginTop: 14, border: '1.5px solid var(--border)', borderRadius: 13, padding: 14, background: 'var(--bg)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {soloNuevas ? 'Nuevas variantes' : 'Opciones'}
      </div>
      <div style={{ fontSize: 12.3, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12 }}>
        Escribe una opción (Talla, Color…) y sus valores. El sistema arma todas las combinaciones y
        cada una lleva su propio inventario.
      </div>

      {opciones.map((op, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={op.nombre}
              onChange={(e) => setOpcion(i, { nombre: e.target.value })}
              placeholder={i === 0 ? 'Talla' : 'Color'}
              style={{ ...campo, flex: 1 }}
            />
            {opciones.length > 1 && (
              <button
                onClick={() => regenerar(opciones.filter((_, j) => j !== i))}
                aria-label="Quitar opción"
                className="v-hover-danger"
                style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {op.valores.map((v) => (
              <span
                key={v}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 6px 0 11px', borderRadius: 8, background: '#EEF0FE', color: '#4338CA', fontWeight: 700, fontSize: 12.8 }}
              >
                {v}
                <button
                  onClick={() => setOpcion(i, { valores: op.valores.filter((x) => x !== v) })}
                  aria-label={`Quitar ${v}`}
                  style={{ width: 18, height: 18, borderRadius: 5, cursor: 'pointer', color: '#4338CA', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={valorNuevo[i] ?? ''}
              onChange={(e) => setValorNuevo((st) => ({ ...st, [i]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  agregarValor(i)
                }
              }}
              placeholder="Agrega un valor y pulsa Enter"
              style={{ ...campo, flex: 1 }}
            />
            <button
              onClick={() => agregarValor(i)}
              className="v-hover-bg"
              style={{ height: 34, padding: '0 13px', borderRadius: 9, background: 'var(--surface)', border: '1.5px solid var(--border)', fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 'none' }}
            >
              Agregar
            </button>
          </div>

          {i === 0 && !op.valores.length && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {SUGERENCIAS.map((sg) => (
                <button
                  key={sg.nombre}
                  onClick={() => setOpcion(i, { nombre: sg.nombre, valores: sg.valores })}
                  className="v-hover-bg"
                  style={{ height: 28, padding: '0 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12.2, cursor: 'pointer' }}
                >
                  {sg.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {opciones.length < 2 && (
        <button
          onClick={() => setOpciones([...opciones, { nombre: '', valores: [] }])}
          className="v-hover-underline"
          style={{ fontSize: 13, fontWeight: 700, color: '#6366F1', cursor: 'pointer', background: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icono n="subida" tam={14} />
          Agregar otra opción (por ejemplo, Color)
        </button>
      )}

      {filas.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '16px 0 8px', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {filas.length} {filas.length === 1 ? 'variante' : 'variantes'}
            </div>
            <div style={{ fontSize: 12.2, color: 'var(--muted)' }}>
              Precio vacío = {precioBase ? `$ ${precioBase}` : 'el precio general'}
            </div>
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
            {filas.map((f, i) => (
              <div
                key={f.label}
                style={{ padding: 10, borderBottom: i === filas.length - 1 ? 'none' : '1px solid var(--bg)', display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1, minWidth: 0 }}>{f.label}</span>
                  <button
                    onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                    className="v-hover-danger"
                    style={{ fontSize: 12.2, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer', background: 'none', flex: 'none' }}
                  >
                    Quitar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 7 }}>
                  <input
                    value={f.stock}
                    onChange={(e) => setFila(i, { stock: e.target.value })}
                    inputMode="numeric"
                    placeholder={porPeso ? 'kg' : 'Stock'}
                    aria-label={`Stock de ${f.label}`}
                    style={campoNum}
                  />
                  <input
                    value={f.price}
                    onChange={(e) => setFila(i, { price: e.target.value })}
                    inputMode="numeric"
                    placeholder="Precio"
                    aria-label={`Precio de ${f.label}`}
                    style={campoNum}
                  />
                  <input
                    value={f.sku}
                    onChange={(e) => setFila(i, { sku: e.target.value })}
                    placeholder="SKU"
                    aria-label={`SKU de ${f.label}`}
                    style={campo}
                  />
                  <input
                    value={f.barcode}
                    onChange={(e) => setFila(i, { barcode: e.target.value })}
                    inputMode="numeric"
                    placeholder="Código"
                    aria-label={`Código de barras de ${f.label}`}
                    style={campo}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {duplicadas > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#B4740A' }}>
          {duplicadas} de estas combinaciones ya existen y no se volverán a crear.
        </div>
      )}
    </div>
  )
}
