'use client'

// Importador de productos desde CSV (Excel → "Guardar como CSV").
// Plantilla descargable, vista previa con validación y reporte de omitidos.

import { useState } from 'react'
import { useApp } from '../store'
import { api } from '../api'
import { Modal, ModalTitle } from '../ui'
import { Icono } from '@/components/Icono'

interface ParsedRow {
  name: string
  price: number
  cost?: number
  category?: string
  sku?: string
  barcode?: string
  stock: number
  minStock: number
  unit: 'und' | 'kg'
  supplier?: string
}

interface RowError {
  line: number
  reason: string
}

// Parser CSV pequeño: comillas, separador , o ; (detectado por el encabezado)
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_ ]/g, '')
    .trim()

// Encabezado de la plantilla → campo interno
const HEADER_MAP: Record<string, string> = {
  nombre: 'name',
  producto: 'name',
  precio: 'price',
  'precio de venta': 'price',
  costo: 'cost',
  categoria: 'category',
  sku: 'sku',
  codigo: 'barcode',
  'codigo de barras': 'barcode',
  codigo_barras: 'barcode',
  stock: 'stock',
  cantidad: 'stock',
  'stock minimo': 'minStock',
  stock_minimo: 'minStock',
  unidad: 'unit',
  proveedor: 'supplier',
}

// COP enteros: se ignoran puntos/comas de miles ("8.000" → 8000)
const parseMoney = (v: string) => parseInt((v || '').replace(/\D/g, '')) || 0
// Cantidades: decimal con coma o punto (para kg)
const parseQty = (v: string) => {
  const n = parseFloat((v || '').replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : 0
}

const TEMPLATE =
  'nombre;precio;costo;categoria;sku;codigo_barras;stock;stock_minimo;unidad;proveedor\n' +
  'Arroz Diana 500g;2500;2000;Granos;;7701001234567;24;5;und;Distribuidora El Surtidor\n' +
  'Tomate chonto;8000;5500;Verduras;;;10;2;kg;\n' +
  'Camiseta basica M;35000;20000;Ropa;CAM-M;;12;3;und;Confecciones Andina\n'

export default function ImportarModal() {
  const s = useApp()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [errors, setErrors] = useState<RowError[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: Array<{ name: string; reason: string }> } | null>(null)

  const downloadTemplate = () => {
    // BOM para que Excel abra las tildes bien
    const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'plantilla-productos.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const text = await file.text()
    const parsed = parseCsv(text.replace(/^﻿/, ''))
    if (parsed.length < 2) {
      setRows([])
      setErrors([{ line: 1, reason: 'El archivo no tiene filas de datos (solo el encabezado o está vacío)' }])
      return
    }
    const headers = parsed[0].map((h) => HEADER_MAP[norm(h)] ?? null)
    if (!headers.includes('name') || !headers.includes('price')) {
      setRows([])
      setErrors([{ line: 1, reason: 'El encabezado debe incluir al menos "nombre" y "precio". Usa la plantilla.' }])
      return
    }
    const out: ParsedRow[] = []
    const errs: RowError[] = []
    parsed.slice(1).forEach((cells, idx) => {
      const line = idx + 2
      const rec: Record<string, string> = {}
      headers.forEach((h, i) => {
        if (h) rec[h] = (cells[i] ?? '').trim()
      })
      const name = rec.name ?? ''
      const price = parseMoney(rec.price)
      if (!name) return errs.push({ line, reason: 'Sin nombre' })
      if (price <= 0) return errs.push({ line, reason: `"${name}": precio inválido` })
      const unit = norm(rec.unit ?? '') === 'kg' ? 'kg' : 'und'
      out.push({
        name,
        price,
        cost: rec.cost ? parseMoney(rec.cost) : undefined,
        category: rec.category || undefined,
        sku: rec.sku || undefined,
        barcode: rec.barcode || undefined,
        stock: parseQty(rec.stock ?? ''),
        minStock: parseQty(rec.minStock ?? ''),
        unit,
        supplier: rec.supplier || undefined,
      })
    })
    setRows(out)
    setErrors(errs)
  }

  const doImport = async () => {
    if (!rows.length || busy) return
    setBusy(true)
    try {
      const r = await api.importProducts(rows)
      setResult({ created: r.created, skipped: r.skipped })
      setRows([])
      await s.refreshAll()
      s.toast(`${r.created} producto${r.created === 1 ? '' : 's'} importado${r.created === 1 ? '' : 's'}`)
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'No se pudo importar')
    } finally {
      setBusy(false)
    }
  }

  const th: React.CSSProperties = { padding: '7px 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12.5, borderTop: '1px solid #EEF2F7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }

  return (
    <Modal onClose={s.closeModal} maxWidth={560}>
      <ModalTitle onClose={s.closeModal}>Importar productos</ModalTitle>

      <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Sube un archivo <b>CSV</b> con tus productos. Si los tienes en Excel, usa{' '}
        <b>Archivo → Guardar como → CSV</b>. Los precios van en pesos sin puntos (ej. 8000) y la
        columna <b>unidad</b> acepta <b>und</b> o <b>kg</b> (por peso).
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          onClick={downloadTemplate}
          className="v-hover-bg"
          style={{ height: 44, padding: '0 16px', borderRadius: 11, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Icono n="descarga" tam={15} />
          Descargar plantilla
        </button>
        <label
          style={{ height: 44, padding: '0 16px', borderRadius: 11, background: '#EEF0FE', color: '#4338CA', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          Elegir archivo…
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
        {fileName && <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--muted)' }}>{fileName}</span>}
      </div>

      {errors.length > 0 && (
        <div style={{ marginTop: 14, background: '#FDECEC', borderRadius: 11, padding: '10px 14px', fontSize: 13, color: '#C9433B', maxHeight: 120, overflowY: 'auto' }}>
          {errors.slice(0, 10).map((e, i) => (
            <div key={i}>Fila {e.line}: {e.reason}</div>
          ))}
          {errors.length > 10 && <div>… y {errors.length - 10} más</div>}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ marginTop: 14, fontSize: 13.5, fontWeight: 700 }}>
            {rows.length} producto{rows.length === 1 ? '' : 's'} listo{rows.length === 1 ? '' : 's'} para importar
            {errors.length > 0 && <span style={{ color: '#C9433B', fontWeight: 600 }}> · {errors.length} con errores (se omiten)</span>}
          </div>
          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Nombre</th>
                  <th style={th}>Precio</th>
                  <th style={th}>Stock</th>
                  <th style={th}>Unidad</th>
                  <th style={th}>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.name}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(r.price)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.stock}{r.unit === 'kg' ? ' kg' : ''}</td>
                    <td style={td}>{r.unit}</td>
                    <td style={td}>{r.category ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <div style={{ padding: 8, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>… y {rows.length - 50} más</div>
            )}
          </div>
        </>
      )}

      {result && (
        <div style={{ marginTop: 14, background: '#EEF0FE', borderRadius: 11, padding: '12px 14px', fontSize: 13.5, color: '#4338CA' }}>
          <b>{result.created}</b> producto{result.created === 1 ? '' : 's'} importado{result.created === 1 ? '' : 's'} ✓
          {result.skipped.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 110, overflowY: 'auto', color: '#8A6B2E' }}>
              {result.skipped.length} omitido{result.skipped.length === 1 ? '' : 's'}:
              {result.skipped.slice(0, 8).map((sk, i) => (
                <div key={i} style={{ fontSize: 12.5 }}>· {sk.name} — {sk.reason}</div>
              ))}
              {result.skipped.length > 8 && <div style={{ fontSize: 12.5 }}>… y {result.skipped.length - 8} más</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={s.closeModal} style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
          {result ? 'Cerrar' : 'Cancelar'}
        </button>
        <button
          onClick={doImport}
          disabled={!rows.length || busy}
          className="v-hover-primary"
          style={{ flex: 1.4, height: 48, borderRadius: 12, background: rows.length && !busy ? '#6366F1' : '#C7CDEC', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: rows.length && !busy ? 'pointer' : 'not-allowed', boxShadow: rows.length && !busy ? '0 8px 18px -8px #6366F1cc' : undefined }}
        >
          {busy ? 'Importando…' : `Importar${rows.length ? ` ${rows.length}` : ''}`}
        </button>
      </div>
    </Modal>
  )
}
