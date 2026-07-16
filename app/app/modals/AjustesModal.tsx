'use client'

// Modal de Ajustes — réplica 1:1 del prototipo (docs/prototype/Ventory POS.dc.html)

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle } from '../ui'

const sectionStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.7px',
  color: '#94A3B8',
  textTransform: 'uppercase',
  margin: '14px 0 8px',
}

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
}

const textInputStyle: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 14.5,
  fontWeight: 600,
}

const numInputStyle: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 11,
  background: 'var(--input)',
  fontSize: 15,
  fontWeight: 700,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const rowBtnStyle: CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 11,
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'left',
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

function themeBtnStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    height: 40,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: 'pointer',
    transition: 'all .13s',
    border: active ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
    background: active ? '#6366F1' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
  }
}

export default function AjustesModal() {
  const s = useApp()
  const [name, setName] = useState(s.settings?.name ?? '')
  const [currency, setCurrency] = useState(s.settings?.currency ?? '$')
  const [ivaPct, setIvaPct] = useState(s.settings?.ivaPct ?? 0)
  const [apertura, setApertura] = useState(s.settings?.defaultOpeningAmount ?? 0)
  const [taxId, setTaxId] = useState(s.settings?.taxId ?? '')
  const [phone, setPhone] = useState(s.settings?.phone ?? '')
  const [address, setAddress] = useState(s.settings?.address ?? '')
  const [receiptFooter, setReceiptFooter] = useState(s.settings?.receiptFooter ?? '')
  // Preferencia de novedades: solo local, se guarda en este navegador
  const [showNov, setShowNov] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.localStorage.getItem('ventory-novedades') !== '0',
  )

  const toggleNov = () => {
    setShowNov((v) => {
      const next = !v
      window.localStorage.setItem('ventory-novedades', next ? '1' : '0')
      return next
    })
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={440}>
      <ModalTitle onClose={s.closeModal}>Ajustes</ModalTitle>

      <div style={{ ...sectionStyle, margin: '0 0 8px' }}>Apariencia</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Tema</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(
          [
            ['claro', 'Claro'],
            ['oscuro', 'Oscuro'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => s.setTheme(k)} style={themeBtnStyle(s.theme === k)}>
            {label}
          </button>
        ))}
      </div>

      <div style={sectionStyle}>Negocio</div>
      <label style={fieldLabelStyle}>Nombre del negocio</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del negocio"
        style={textInputStyle}
      />

      <div style={sectionStyle}>Facturación</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabelStyle}>NIT</label>
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="900.123.456-7"
            style={textInputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="301 456 7890"
            style={textInputStyle}
          />
        </div>
      </div>
      <label style={{ ...fieldLabelStyle, marginTop: 10 }}>Dirección</label>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Cra 12 #34-56, Bogotá"
        style={textInputStyle}
      />
      <label style={{ ...fieldLabelStyle, marginTop: 10 }}>Mensaje final de la factura</label>
      <input
        value={receiptFooter}
        onChange={(e) => setReceiptFooter(e.target.value)}
        placeholder="¡Gracias por su compra!"
        style={textInputStyle}
      />
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8' }}>
        Estos datos aparecen en la factura de venta. Los campos vacíos no se imprimen.
      </div>

      <div style={sectionStyle}>Impuestos y moneda</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabelStyle}>IVA (%) incluido</label>
          <input
            value={ivaPct ? String(ivaPct) : ''}
            onChange={(e) => setIvaPct(Math.min(30, parseInt(String(e.target.value).replace(/\D/g, '')) || 0))}
            inputMode="numeric"
            placeholder="0"
            style={numInputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              padding: '0 12px',
              border: '1.5px solid var(--border)',
              borderRadius: 11,
              background: 'var(--input)',
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {['$', 'COP', 'US$', '€', 'Bs'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8' }}>
        IVA incluido en el precio · desglose informativo
      </div>

      <div style={sectionStyle}>Caja</div>
      <label style={fieldLabelStyle}>Base de caja por defecto</label>
      <input
        value={apertura ? String(apertura) : ''}
        onChange={(e) => setApertura(parseInt(String(e.target.value).replace(/\D/g, '')) || 0)}
        inputMode="numeric"
        placeholder="0"
        style={numInputStyle}
      />
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8' }}>
        Monto de apertura sugerido al abrir un nuevo turno.
      </div>

      {s.isAdmin && (
        <>
          <div style={sectionStyle}>Cuenta</div>
          <button onClick={() => s.openModal('usuarios')} className="v-hover-bg" style={rowBtnStyle}>
            Gestión de usuarios <span style={{ color: '#6366F1' }}>→</span>
          </button>
        </>
      )}

      <div style={sectionStyle}>Novedades</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Mostrar novedades</div>
          <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 1 }}>Se guarda en este navegador.</div>
        </div>
        <button
          onClick={toggleNov}
          aria-label="Mostrar novedades"
          style={{
            width: 46,
            height: 26,
            borderRadius: 13,
            cursor: 'pointer',
            transition: 'all .15s',
            position: 'relative',
            flex: 'none',
            background: showNov ? '#6366F1' : '#CBD5E1',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'all .15s',
              left: showNov ? 23 : 3,
            }}
          />
        </button>
      </div>
      <button
        onClick={() => s.openModal('novedades')}
        className="v-hover-bg"
        style={{ ...rowBtnStyle, marginTop: 10 }}
      >
        Ver novedades <span style={{ color: '#6366F1' }}>→</span>
      </button>

      <button
        onClick={() =>
          s.saveSettings({
            name: name.trim(),
            currency,
            ivaPct,
            defaultOpeningAmount: apertura,
            taxId: taxId.trim(),
            phone: phone.trim(),
            address: address.trim(),
            receiptFooter: receiptFooter.trim(),
          })
        }
        className="v-hover-primary"
        style={{
          width: '100%',
          height: 48,
          marginTop: 22,
          borderRadius: 12,
          background: '#6366F1',
          color: '#fff',
          fontWeight: 800,
          fontSize: 14.5,
          cursor: 'pointer',
          boxShadow: '0 8px 18px -8px #6366F1cc',
        }}
      >
        Guardar ajustes
      </button>
    </Modal>
  )
}
