'use client'

// Campo numérico con teclado propio en pantalla — reemplaza un <input
// inputMode="numeric"> nativo en cualquier parte del sistema. No depende de
// que el dispositivo muestre su propio teclado: en celulares específicos y
// sobre todo en pantallas táctiles sin teclado físico (un todo-en-uno), eso
// no es confiable. Mismo look que el campo que reemplaza (recibe su style),
// y al tocarlo abre el mismo teclado que ya usan peso, cantidad y precio.

import { CSSProperties, useState } from 'react'
import TecladoPeso, { aplicarTecla, useTecladoFisico } from './TecladoPeso'

export default function CampoNumerico({
  value,
  onChange,
  decimales = false,
  placeholder = '0',
  style,
  titulo,
  disabled,
  ariaLabel,
}: {
  value: string | number
  /** Recibe el texto crudo digitado (igual que e.target.value de un input) */
  onChange: (raw: string) => void
  decimales?: boolean
  placeholder?: string
  style?: CSSProperties
  titulo?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [raw, setRaw] = useState('')

  const press = (k: string) => setRaw((r) => aplicarTecla(r, k))
  useTecladoFisico(press, abierto)

  const texto = value === 0 || value === '' || value == null ? '' : String(value)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => {
          setRaw('')
          setAbierto(true)
        }}
        style={{
          fontFamily: 'inherit',
          ...style,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: texto ? style?.color : 'var(--muted)',
        }}
      >
        {texto || placeholder}
      </button>
      {abierto && (
        <div
          data-no-print="true"
          onClick={() => setAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 340, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
          >
            {titulo && <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{titulo}</h2>}
            <div style={{ marginTop: titulo ? 12 : 0, background: '#0F172A', borderRadius: 14, padding: '14px 18px', textAlign: 'right' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px' }}>
                {raw || '0'}
              </span>
            </div>
            <div style={{ marginTop: 14 }}>
              <TecladoPeso onTecla={press} decimales={decimales} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setAbierto(false)} style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  onChange(raw)
                  setAbierto(false)
                }}
                className="v-hover-primary"
                style={{ flex: 1.3, height: 46, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
