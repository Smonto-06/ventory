'use client'

// Ventana de impresión propia de Ventory.
//
// El botón "Imprimir" abre este selector con la estética del sistema, en vez
// de saltar directo al diálogo del navegador. Ofrece:
//
//  - Impresora térmica (USB/Bluetooth): imprime directo, sin ningún diálogo.
//  - Impresora del computador: abre la ventana de impresión del sistema. Esa
//    ventana no se puede reemplazar —el navegador no deja ver ni manejar las
//    impresoras normales del equipo por seguridad—, así que se ofrece como lo
//    que es: la puerta a las impresoras del computador.
//
// La última elección se recuerda y aparece preseleccionada; nada se imprime
// nunca sin que el usuario lo pida.

import { useEffect, useState } from 'react'
import { useApp } from './store'
import { Icono } from '@/components/Icono'
import { printerPref, printThermal, TicketLine } from './printer'

const VIA_KEY = 'ventory-imprimir-via'

type Via = 'termica' | 'sistema'

function viaPreferida(): Via {
  try {
    const v = localStorage.getItem(VIA_KEY)
    if (v === 'termica' || v === 'sistema') return v
  } catch {
    /* sin almacenamiento */
  }
  return 'termica'
}

export default function BotonImprimir({
  lineas,
  etiqueta = 'Imprimir',
  alto = 46,
  flex,
  onImpreso,
}: {
  /** Contenido en formato de tiquete térmico; sin esto solo queda el sistema */
  lineas?: () => TicketLine[]
  etiqueta?: string
  alto?: number
  flex?: number
  onImpreso?: (via: Via) => void
}) {
  const s = useApp()
  const [abierto, setAbierto] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [termicaConfigurada, setTermicaConfigurada] = useState<'usb' | 'bt' | null>(null)
  const [sel, setSel] = useState<Via>('sistema')

  useEffect(() => {
    if (!abierto) return
    const pref = printerPref()
    setTermicaConfigurada(pref)
    // preselección: la última vía usada, si sigue disponible
    const guardada = viaPreferida()
    setSel(guardada === 'termica' && (!lineas || !pref) ? 'sistema' : guardada)
  }, [abierto, lineas])

  const imprimir = async (via: Via) => {
    setImprimiendo(true)
    try {
      if (via === 'termica') {
        await printThermal(lineas!())
        s.toast('Impreso en la térmica')
      } else {
        // el diálogo bloquea el hilo: cerrar el modal antes para que no quede visible
        setAbierto(false)
        await new Promise((r) => setTimeout(r, 60))
        window.print()
      }
      try {
        localStorage.setItem(VIA_KEY, via)
      } catch {
        /* sin almacenamiento */
      }
      setAbierto(false)
      onImpreso?.(via)
    } catch {
      s.toast('No se pudo imprimir en la térmica. Revisa la conexión o usa la impresora del computador.')
    } finally {
      setImprimiendo(false)
    }
  }

  const termicaDisponible = !!lineas && !!termicaConfigurada

  const opcion = (
    via: Via,
    icono: 'impresora' | 'monitor',
    titulo: string,
    detalle: string,
    disponible: boolean,
  ) => (
    <button
      key={via}
      disabled={!disponible || imprimiendo}
      onClick={() => setSel(via)}
      onDoubleClick={() => disponible && imprimir(via)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '14px 15px',
        borderRadius: 13,
        textAlign: 'left',
        border: `1.5px solid ${sel === via && disponible ? '#6366F1' : 'var(--border)'}`,
        background: sel === via && disponible ? '#EEF0FE' : 'var(--surface)',
        cursor: disponible ? 'pointer' : 'not-allowed',
        opacity: disponible ? 1 : 0.55,
        transition: 'all .13s',
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: sel === via && disponible ? '#6366F1' : 'var(--bg)',
          color: sel === via && disponible ? '#fff' : 'var(--muted)',
        }}
      >
        <Icono n={icono} tam={20} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
          {detalle}
        </span>
      </span>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          flex: 'none',
          border: sel === via && disponible ? '6px solid #6366F1' : '2px solid var(--border)',
          background: 'var(--surface)',
          transition: 'all .13s',
        }}
      />
    </button>
  )

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="v-hover-bg"
        style={{
          ...(flex !== undefined ? { flex } : {}),
          height: alto,
          padding: '0 18px',
          borderRadius: 12,
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          color: 'var(--text)',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Icono n="impresora" tam={16} />
        {etiqueta}
      </button>

      {abierto && (
        <div
          data-no-print="true"
          onClick={() => setAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.45)',
            zIndex: 130,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'var(--surface)',
              borderRadius: 18,
              padding: 22,
              boxShadow: '0 30px 60px -30px rgba(15,25,23,.6)',
              animation: 'vpop .25s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Imprimir</h2>
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--muted)' }}>¿Por dónde sale?</div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {opcion(
                'termica',
                'impresora',
                'Impresora térmica',
                lineas
                  ? termicaConfigurada
                    ? `Conectada por ${termicaConfigurada === 'usb' ? 'USB' : 'Bluetooth'} · imprime directo, sin ventanas`
                    : 'No hay ninguna conectada. Conéctala en Ajustes → Impresora de tickets.'
                  : 'Este documento no tiene formato de tiquete',
                termicaDisponible,
              )}
              {opcion(
                'sistema',
                'monitor',
                'Impresora del computador',
                'Abre la ventana de impresión del sistema para elegir entre tus impresoras instaladas',
                true,
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setAbierto(false)}
                style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => imprimir(sel)}
                disabled={imprimiendo || (sel === 'termica' && !termicaDisponible)}
                className="v-hover-primary"
                style={{
                  flex: 1.4,
                  height: 46,
                  borderRadius: 12,
                  background: imprimiendo ? '#C7CDEC' : '#6366F1',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14.5,
                  cursor: imprimiendo ? 'wait' : 'pointer',
                  boxShadow: imprimiendo ? 'none' : '0 8px 18px -8px #6366F1cc',
                }}
              >
                {imprimiendo ? 'Imprimiendo…' : 'Imprimir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
