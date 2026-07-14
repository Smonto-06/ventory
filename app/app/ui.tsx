'use client'

// Átomos de UI compartidos — estilos y helpers copiados 1:1 del prototipo
// (docs/prototype/Ventory POS.dc.html). Los colores y radios son los del diseño aprobado.

import { CSSProperties, ReactNode } from 'react'

// Paleta de tintes para tiles de producto (por índice estable)
export const TINTS: Array<[string, string]> = [
  ['#EEF0FE', '#6366F1'],
  ['#EEF0FE', '#6366F1'],
  ['#FDF1E7', '#D9820E'],
  ['#F2EEFB', '#7B4FD4'],
  ['#FCEEF3', '#C74B7E'],
  ['#E9F4F8', '#2E8CB0'],
]

export function hashIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

export function tint(id: string): [string, string] {
  return TINTS[hashIndex(id) % TINTS.length]
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// Tile de producto: foto o iniciales sobre gradiente
export function tileFor(p: { id: string; name: string; imageUrl?: string | null }) {
  const [bg, fg] = tint(p.id)
  if (p.imageUrl) {
    return {
      tileStyle: {
        backgroundImage: `url(${p.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } as CSSProperties,
      tileText: '',
      tileFg: fg,
    }
  }
  return {
    tileStyle: {
      background: `linear-gradient(140deg, ${bg} 0%, ${fg}26 100%)`,
    } as CSSProperties,
    tileText: initials(p.name),
    tileFg: fg,
  }
}

// Chip de etiqueta (categorías, métodos, estados)
export function chipStyle(bg: string, fg: string): CSSProperties {
  return {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    background: bg,
    color: fg,
    whiteSpace: 'nowrap',
  }
}

const CAT_TINTS: Record<string, [string, string]> = {
  'Ropa Mujer': ['#FCEEF3', '#C74B7E'],
  'Ropa Hombre': ['#E9F4F8', '#2E8CB0'],
  Accesorios: ['#FDF1E7', '#D9820E'],
  Calzado: ['#F2EEFB', '#7B4FD4'],
}

export function catChipStyle(cat: string): CSSProperties {
  const [bg, fg] = CAT_TINTS[cat] ?? ['#EEF2F7', '#4B515E']
  return chipStyle(bg, fg)
}

// Tinte por método de pago (etiquetas del prototipo)
export function methodTint(m: string): [string, string] {
  if (m && m.includes('+')) return ['#EEF2F7', '#4B515E']
  const map: Record<string, [string, string]> = {
    Efectivo: ['#EEF0FE', '#4338CA'],
    Tarjeta: ['#F2EEFB', '#7B4FD4'],
    Transferencia: ['#E9F4F8', '#2E8CB0'],
    Crédito: ['#FDF4E5', '#B4740A'],
    Mixto: ['#EEF2F7', '#4B515E'],
  }
  return map[m] ?? ['#EEF2F7', '#4B515E']
}

// Método del backend → etiqueta del prototipo
export function methodLabel(method: string, payments?: Array<{ method: string }>): string {
  const map: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
  }
  if (method === 'MIXED' && payments?.length) {
    return payments.map((p) => map[p.method] ?? p.method).join(' + ')
  }
  return map[method] ?? method
}

// Botón guardar (habilitado índigo / deshabilitado lila)
export function saveBtnStyle(ok: boolean): CSSProperties {
  return {
    flex: 1.4,
    height: 48,
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 14.5,
    color: '#fff',
    cursor: ok ? 'pointer' : 'not-allowed',
    background: ok ? '#6366F1' : '#C7CDEC',
    boxShadow: ok ? '0 8px 18px -8px #6366F1cc' : undefined,
  }
}

export const inputStyle: CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 15,
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '14px 0 7px',
}

export const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(16,20,30,.04)',
}

// Overlay + tarjeta de modal (animación vpop del prototipo)
export function Modal({
  children,
  onClose,
  maxWidth = 480,
}: {
  children: ReactNode
  onClose: () => void
  maxWidth?: number
}) {
  return (
    <div
      data-no-print="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 18,
          padding: 24,
          animation: 'vpop .18s ease',
          boxShadow: '0 30px 70px -20px rgba(15,23,42,.45)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalTitle({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18.5, fontWeight: 800, letterSpacing: '-.3px' }}>{children}</h2>
      <button
        onClick={onClose}
        style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg)', color: 'var(--muted)', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
      >
        ✕
      </button>
    </div>
  )
}

// Logo Ventory oficial: chulo en V con trazo violeta→azul (largo) y
// turquesa→azul (corto) que cruza al frente con transparencia
export function VLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 32) / 36} viewBox="0 0 36 32" fill="none">
      <defs>
        <linearGradient id="vlogo-r" x1="31" y1="5" x2="15" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#4E6AF3" />
        </linearGradient>
        <linearGradient id="vlogo-l" x1="5" y1="8" x2="15" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1FE0A6" />
          <stop offset="0.55" stopColor="#2CC8DB" />
          <stop offset="1" stopColor="#3B9DF8" />
        </linearGradient>
      </defs>
      <path d="M15 26L31 5" stroke="url(#vlogo-r)" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8L15 26" stroke="url(#vlogo-l)" strokeOpacity="0.92" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Denominaciones de billetes/monedas COP (teclados de conteo)
export const BILLS = [100000, 50000, 20000, 10000, 5000, 2000]
export const COINS = [1000, 500, 200, 100, 50]
export const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]
export const DENOM_LABELS = ['100k', '50k', '20k', '10k', '5k', '2k', '1k', '500', '200', '100']
