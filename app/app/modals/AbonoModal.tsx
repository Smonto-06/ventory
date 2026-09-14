'use client'

// Modal Registrar abono — réplica del bloque mAbono del prototipo
// (docs/prototype/Ventory POS.dc.html). El store navega al recibo del abono.

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle, labelStyle } from '../ui'
import CampoNumerico from './CampoNumerico'

type Metodo = 'CASH' | 'CARD' | 'TRANSFER'

const METODOS: Array<[Metodo, string]> = [
  ['CASH', 'Efectivo'],
  ['CARD', 'Tarjeta'],
  ['TRANSFER', 'Transf.'],
]

function pillStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '11px 8px',
    borderRadius: 11,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: 'pointer',
    transition: 'all .13s',
    border: `1.5px solid ${active ? '#6366F1' : 'var(--border)'}`,
    background: active ? '#6366F1' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
  }
}

export default function AbonoModal() {
  const s = useApp()
  const c = s.customers.find((x) => x.id === s.abonoId)

  const [method, setMethod] = useState<Metodo>('CASH')
  const [amount, setAmount] = useState(0)
  const [enviando, setEnviando] = useState(false)

  if (!c) return null

  const ok = amount > 0 && !enviando
  // Registrar un abono por un monto MAYOR al saldo se recortaba en silencio
  // antes de esto, sin un solo aviso: ni el campo se ponía en rojo, ni un
  // toast, ni una marca en el campo — el excedente simplemente no quedaba
  // registrado en ningún lado (la típica plata de más en caja al cierre que
  // nadie sabe de dónde salió).
  const excedente = amount > c.balance ? amount - c.balance : 0

  const save = async () => {
    if (!ok) return
    setEnviando(true)
    try {
      await s.payClient(c.id, Math.min(amount, c.balance), method)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={420}>
      <ModalTitle onClose={s.closeModal}>Registrar abono</ModalTitle>

      <div style={{ background: '#FDF4E5', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: '#8A6B2E', marginTop: 2 }}>Saldo pendiente</div>
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#B4740A', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(c.balance)}</div>
      </div>

      <label style={labelStyle}>Método de pago</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {METODOS.map(([k, label]) => (
          <button key={k} onClick={() => setMethod(k)} style={pillStyle(method === k)}>
            {label}
          </button>
        ))}
      </div>

      <label style={labelStyle}>Monto del abono</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <CampoNumerico
          value={amount ? String(amount) : ''}
          onChange={(raw) => setAmount(parseInt(raw.replace(/\D/g, ''), 10) || 0)}
          titulo="Monto del abono"
          style={{
            flex: 1,
            height: 48,
            padding: '0 14px',
            border: '1.5px solid var(--border)',
            borderRadius: 11,
            background: 'var(--input)',
            fontSize: 16,
            fontWeight: 700,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 0,
          }}
        />
        <button
          onClick={() => setAmount(c.balance)}
          style={{ height: 48, padding: '0 16px', borderRadius: 11, background: '#EEF0FE', color: '#4338CA', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
        >
          Saldo total
        </button>
      </div>
      {excedente > 0 && (
        <div style={{ marginTop: 10, background: '#FDECEC', border: '1px solid #F5C2C2', borderRadius: 11, padding: '10px 13px', fontSize: 12.5, color: '#9A2E2E', lineHeight: 1.5 }}>
          El cliente solo debe {s.fmt(c.balance)}. Se registrará ese monto — los {s.fmt(excedente)}{' '}
          de más no quedan guardados en ningún lado. Si de verdad recibiste ese dinero, devuelve el
          excedente o corrige el monto.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={s.closeModal}
          style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button onClick={save} style={saveBtnStyle(ok)}>
          {enviando ? 'Guardando…' : 'Registrar abono'}
        </button>
      </div>
    </Modal>
  )
}
