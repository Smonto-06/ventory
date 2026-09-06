'use client'

// Modal PAGO A PROVEEDOR — réplica 1:1 del prototipo (mAbonoCompra).

import { useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle, saveBtnStyle, labelStyle } from '../ui'
import CampoNumerico from './CampoNumerico'

type MethodKey = 'efectivo' | 'tarjeta' | 'transferencia'

const METHODS: Array<[MethodKey, string]> = [
  ['efectivo', 'Efectivo'],
  ['tarjeta', 'Tarjeta'],
  ['transferencia', 'Transf.'],
]

const API_METHOD: Record<MethodKey, string> = {
  efectivo: 'CASH',
  tarjeta: 'CARD',
  transferencia: 'TRANSFER',
}

export default function AbonoCompraModal() {
  const s = useApp()
  const [method, setMethod] = useState<MethodKey>('efectivo')
  const [amount, setAmount] = useState(0)
  const [enviando, setEnviando] = useState(false)

  const compra = s.purchases.find((c) => c.id === s.abonoCompraId)
  if (!compra) return null

  const saldo = compra.balance
  const ok = amount > 0 && !enviando

  const pagar = async () => {
    if (!ok) return
    setEnviando(true)
    try {
      await s.payCompra(compra.id, amount, API_METHOD[method])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={420}>
      <ModalTitle onClose={s.closeModal}>Pago a proveedor</ModalTitle>
      <div style={{ marginTop: 16, background: '#FDF4E5', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{compra.supplier.name}</div>
          <div style={{ fontSize: 12.5, color: '#8A6B2E', marginTop: 2 }}>Saldo pendiente</div>
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#B4740A', fontVariantNumeric: 'tabular-nums' }}>{s.fmt(saldo)}</div>
      </div>
      <label style={{ ...labelStyle, margin: '11px 0 5px' }}>Método de pago</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {METHODS.map(([k, l]) => {
          const active = method === k
          return (
            <button
              key={k}
              onClick={() => setMethod(k)}
              style={{
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
              }}
            >
              {l}
            </button>
          )
        })}
      </div>
      <label style={{ ...labelStyle, margin: '10px 0 5px' }}>Monto del pago</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <CampoNumerico
          value={amount || ''}
          onChange={(raw) => setAmount(parseInt(raw.replace(/\D/g, '')) || 0)}
          placeholder="0"
          titulo="Monto del pago"
          style={{ flex: 1, height: 48, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        />
        <button
          onClick={() => setAmount(saldo)}
          style={{ height: 48, padding: '0 16px', borderRadius: 11, background: '#EEF0FE', color: '#4338CA', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
        >
          Saldo total
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={s.closeModal}
          className="v-hover-bg"
          style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button onClick={pagar} style={saveBtnStyle(ok)}>
          {enviando ? 'Guardando…' : 'Registrar pago'}
        </button>
      </div>
    </Modal>
  )
}
