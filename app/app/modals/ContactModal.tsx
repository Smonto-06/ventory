'use client'

// Modal Contáctanos — réplica 1:1 del prototipo (docs/prototype/Ventory POS.dc.html).
// Abre el correo del usuario (mailto:) con el mensaje listo para ventorypos@gmail.com.

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, saveBtnStyle } from '../ui'

type ContactType = 'sugerencia' | 'error' | 'queja'

const TYPES: Array<[ContactType, string]> = [
  ['sugerencia', 'Sugerencia'],
  ['error', 'Error'],
  ['queja', 'Queja o reclamo'],
]

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '14px 0 7px',
}

function pillStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '10px 6px',
    borderRadius: 11,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all .13s',
    border: active ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
    background: active ? '#6366F1' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
  }
}

export default function ContactModal() {
  const s = useApp()
  const [type, setType] = useState<ContactType>('sugerencia')
  const [subject, setSubject] = useState('')
  const [msg, setMsg] = useState('')

  const ok = !!(subject.trim() && msg.trim())

  const sendContact = () => {
    const subj = subject.trim()
    const body = msg.trim()
    if (!subj || !body) return
    const tipo = TYPES.find(([k]) => k === type)?.[1] ?? 'Sugerencia'
    const asunto = `[${tipo}] ${subj}`
    const cuerpo = `${body}\n\n—\nEnviado desde Ventory · ${s.settings?.name ?? ''} · Usuario: ${s.me.name}`
    const href =
      'mailto:ventorypos@gmail.com?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo)
    try {
      window.location.href = href
    } catch {
      // sin cliente de correo disponible
    }
    s.closeModal()
    s.toast('Abriendo tu correo…')
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={460}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M2.5 4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7z" stroke="#fff" strokeWidth="1.4" />
            <path d="M3 5l5 3.5L13 5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Contáctanos</h2>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>
            Envíanos una sugerencia, error o reclamo
          </div>
        </div>
        <button
          onClick={s.closeModal}
          className="v-hover-bg"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'var(--bg)',
            color: '#5A616E',
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          ×
        </button>
      </div>

      <label style={{ ...fieldLabelStyle, margin: '16px 0 7px' }}>Tipo de mensaje</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {TYPES.map(([k, label]) => (
          <button key={k} onClick={() => setType(k)} style={pillStyle(type === k)}>
            {label}
          </button>
        ))}
      </div>

      <label style={fieldLabelStyle}>Asunto</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Resume tu mensaje en una línea"
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 11,
          background: 'var(--input)',
          fontSize: 14.5,
        }}
      />
      <label style={fieldLabelStyle}>Mensaje</label>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Cuéntanos con detalle qué ocurrió o qué te gustaría mejorar…"
        style={{
          width: '100%',
          minHeight: 110,
          padding: '11px 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 11,
          background: 'var(--input)',
          fontSize: 14.5,
          resize: 'vertical',
          lineHeight: 1.5,
        }}
      />
      <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
        Se abrirá tu correo con el mensaje listo para enviar a{' '}
        <b style={{ color: 'var(--text)' }}>ventorypos@gmail.com</b>.
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          onClick={s.closeModal}
          className="v-hover-bg"
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
        <button onClick={sendContact} style={saveBtnStyle(ok)}>
          Enviar mensaje
        </button>
      </div>
    </Modal>
  )
}
