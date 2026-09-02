'use client'

// Teclado numérico tipo calculadora — para pesos en kilos (con coma decimal)
// o cantidades enteras de unidades (sin coma, con "00" en su lugar).
//
// Lo comparten el modal de venta por peso, el de devolución y el de elegir
// cantidad: en un mostrador táctil sin teclado físico es la única forma de
// escribir un número, y no tiene sentido que cada pantalla tenga el suyo.

import { useEffect } from 'react'

const TECLAS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'] as const
// Sin decimales (cantidad de unidades, no por peso): la coma no aplica, en
// su lugar un "00" para escribir cantidades grandes más rápido.
const TECLAS_ENTERAS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '⌫'] as const

/** Aplica una tecla al texto digitado. Máximo 3 decimales (gramos). */
export function aplicarTecla(actual: string, tecla: string): string {
  if (tecla === '⌫') return actual.slice(0, -1)
  if (tecla === ',') {
    if (actual.includes(',')) return actual
    return actual === '' ? '0,' : actual + ','
  }
  const dec = actual.split(',')[1]
  if (dec !== undefined && dec.length >= 3) return actual
  if (actual.replace(',', '').length >= 6) return actual
  return actual + tecla
}

/** Escucha el teclado físico y traduce a pulsaciones del teclado en pantalla */
export function useTecladoFisico(press: (k: string) => void, activo = true) {
  useEffect(() => {
    if (!activo) return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === ',' || e.key === '.') press(',')
      else if (e.key === 'Backspace') press('⌫')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo])
}

export default function TecladoPeso({
  onTecla,
  alto = 52,
  decimales = true,
}: {
  onTecla: (k: string) => void
  alto?: number
  /** false = cantidad de unidades, sin coma decimal (ej. elegir cuántos artículos) */
  decimales?: boolean
}) {
  const teclas = decimales ? TECLAS : TECLAS_ENTERAS
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {teclas.map((k) => (
        <button
          key={k}
          onClick={() => onTecla(k)}
          aria-label={k === '⌫' ? 'Borrar' : k === ',' ? 'Coma decimal' : k}
          style={{
            height: alto,
            borderRadius: 12,
            fontWeight: 800,
            fontSize: k === '⌫' ? 17 : 19,
            cursor: 'pointer',
            transition: 'all .1s',
            background: k === '⌫' ? '#FDECEC' : 'var(--bg)',
            color: k === '⌫' ? '#C9433B' : 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {k}
        </button>
      ))}
    </div>
  )
}
