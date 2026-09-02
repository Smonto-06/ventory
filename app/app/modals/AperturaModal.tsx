'use client'

// Cierre de turno + apertura del siguiente — réplica 1:1 del prototipo (mApertura).
// Prefill de la nueva apertura = total contado del cierre.

import { useState } from 'react'
import { useApp } from '../store'
import CampoNumerico from './CampoNumerico'

export default function AperturaModal() {
  const s = useApp()
  const preview = s.cierrePreview
  const [nextApertura, setNextApertura] = useState<number>(preview?.contado || preview?.esperado || 0)

  if (!preview) return null

  const diffColor = preview.diff === 0 ? '#6366F1' : preview.diff > 0 ? '#B4740A' : '#C9433B'

  return (
    <div
      data-no-print="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.45)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease' }}
      >
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Cierre de turno</h2>
        <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Saldo esperado</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(preview.esperado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Total contado</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(preview.contado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Diferencia</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: diffColor }}>
              {(preview.diff >= 0 ? '+ ' : '− ') + s.fmt(Math.abs(preview.diff))}
            </span>
          </div>
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '11px 0 5px' }}>
          Apertura del nuevo turno $
        </label>
        <CampoNumerico
          value={nextApertura || ''}
          onChange={(raw) => setNextApertura(parseInt(raw.replace(/\D/g, '')) || 0)}
          placeholder="0"
          titulo="Apertura del nuevo turno"
          style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        />
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
          Al confirmar se cierra el turno actual y se abre uno nuevo con esta base. El historial de ventas se conserva.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={s.closeModal} style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={() => s.confirmApertura(nextApertura)}
            className="v-hover-primary"
            style={{ flex: 1.4, height: 48, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
          >
            Cerrar y abrir turno
          </button>
        </div>
        <button
          onClick={() => s.confirmCierreFinal()}
          style={{ width: '100%', height: 46, marginTop: 10, borderRadius: 12, background: '#FDECEC', color: '#C9433B', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
        >
          Cierre del día (sin abrir turno nuevo)
        </button>
      </div>
    </div>
  )
}
