'use client'

// Pantalla completa para terminales táctiles.
//
// En un POS táctil no hay teclado, así que no se puede pulsar F11 y la barra
// del navegador se come parte de la pantalla todo el tiempo. Este botón usa la
// API de pantalla completa del navegador para quitarla con un toque.
//
// Notas:
// - Entrar a pantalla completa exige un gesto del usuario, así que no se puede
//   activar sola al abrir el sistema. Sí se recuerda la preferencia para
//   ofrecerlo de nuevo en el punto de venta.
// - Safari en iPhone no soporta la API (sí en iPad y en Android/escritorio).
//   Cuando no hay soporte el botón no se muestra, en vez de fallar en silencio.

import { useCallback, useEffect, useState } from 'react'
import { Icono } from '@/components/Icono'

const PREF_KEY = 'ventory-pantalla-completa'

interface DocumentoConPrefijos extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
interface ElementoConPrefijos extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

function soportado(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.documentElement as ElementoConPrefijos
  return !!(el.requestFullscreen || el.webkitRequestFullscreen)
}

function estaActiva(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as DocumentoConPrefijos
  return !!(d.fullscreenElement || d.webkitFullscreenElement)
}

/** Estado + acciones de pantalla completa, compartido por los botones. */
export function usePantallaCompleta() {
  const [disponible, setDisponible] = useState(false)
  const [activa, setActiva] = useState(false)

  useEffect(() => {
    setDisponible(soportado())
    const sync = () => setActiva(estaActiva())
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const alternar = useCallback(async () => {
    const d = document as DocumentoConPrefijos
    const el = document.documentElement as ElementoConPrefijos
    try {
      if (estaActiva()) {
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())
        try {
          localStorage.setItem(PREF_KEY, '0')
        } catch {
          /* almacenamiento no disponible */
        }
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
        try {
          localStorage.setItem(PREF_KEY, '1')
        } catch {
          /* almacenamiento no disponible */
        }
      }
    } catch {
      // El navegador puede rechazarlo (por ejemplo si no viene de un toque);
      // no hay nada que hacer más que dejar la pantalla como está.
    }
  }, [])

  /** true si el usuario ya la usó antes y ahora no está activa */
  const preferida = (() => {
    try {
      return localStorage.getItem(PREF_KEY) === '1'
    } catch {
      return false
    }
  })()

  return { disponible, activa, alternar, preferida }
}

/**
 * Botón de alternar. `variante`:
 *  - 'icono': cuadrado, para barras de herramientas
 *  - 'fila': ancho completo con texto, para el menú de ajustes
 */
export function BotonPantallaCompleta({
  variante = 'icono',
  tam = 38,
}: {
  variante?: 'icono' | 'fila'
  tam?: number
}) {
  const { disponible, activa, alternar } = usePantallaCompleta()
  if (!disponible) return null

  const etiqueta = activa ? 'Salir de pantalla completa' : 'Pantalla completa'

  if (variante === 'fila') {
    return (
      <button
        onClick={alternar}
        className="v-hover-bg"
        style={{
          width: '100%',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          borderRadius: 11,
          background: 'var(--bg)',
          border: '1.5px solid var(--border)',
          color: 'var(--text)',
          fontWeight: 600,
          fontSize: 13.5,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: '#6366F1', display: 'flex' }}>
          <Icono n={activa ? 'contraer' : 'expandir'} tam={17} />
        </span>
        <span style={{ flex: 1 }}>{etiqueta}</span>
      </button>
    )
  }

  return (
    <button
      onClick={alternar}
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={activa}
      style={{
        width: tam,
        height: tam,
        flex: 'none',
        borderRadius: 10,
        background: activa ? '#EEF0FE' : 'var(--bg)',
        color: activa ? '#4338CA' : '#5A616E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <Icono n={activa ? 'contraer' : 'expandir'} tam={Math.round(tam * 0.46)} />
    </button>
  )
}
