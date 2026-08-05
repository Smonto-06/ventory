'use client'

// Teclado numérico tipo calculadora para digitar pesos en kilos.
//
// Lo comparten el modal de venta por peso y el de devolución: en un mostrador
// táctil sin teclado físico esta es la única forma de escribir "0,750", y no
// tiene sentido que cada pantalla tenga el suyo.

import { useEffect } from 'react'

const TECLAS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'] as const

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
}: {
  onTecla: (k: string) => void
  alto?: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {TECLAS.map((k) => (
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
