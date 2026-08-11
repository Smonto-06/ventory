'use client'

// Modal de Ajustes — réplica 1:1 del prototipo (docs/prototype/Ventory POS.dc.html)

import { CSSProperties, useState } from 'react'
import { useApp } from '../store'
import { Modal, ModalTitle } from '../ui'
import { connectUsb, connectBt, forgetPrinter, printerPref, testPrint } from '../printer'
import { Icono } from '@/components/Icono'

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
  // El encargado (SUPERVISOR) abre Ajustes para lo operativo (tema, impresora,
  // sucursales); lo del dueño —negocio, facturación, notificaciones, plan,
  // usuarios y respaldos— solo lo ve y toca el ADMIN pleno.
  const esDueno = s.me.role === 'ADMIN'
  const [name, setName] = useState(s.settings?.name ?? '')
  const [currency, setCurrency] = useState(s.settings?.currency ?? '$')
  const [ivaPct, setIvaPct] = useState(s.settings?.ivaPct ?? 0)
  const [apertura, setApertura] = useState(s.settings?.defaultOpeningAmount ?? 0)
  const [taxId, setTaxId] = useState(s.settings?.taxId ?? '')
  const [phone, setPhone] = useState(s.settings?.phone ?? '')
  const [address, setAddress] = useState(s.settings?.address ?? '')
  const [receiptFooter, setReceiptFooter] = useState(s.settings?.receiptFooter ?? '')
  const [resumenDiario, setResumenDiario] = useState(!!s.settings?.notifyDailySummary)
  const [avisoStock, setAvisoStock] = useState(s.settings?.notifyLowStock !== false)
  const [correoAviso, setCorreoAviso] = useState(s.settings?.notifyEmail ?? '')
  const [probando, setProbando] = useState(false)
  const [printerState, setPrinterState] = useState<string | null>(printerPref())
  // Gestión de sucursales
  const [newBranch, setNewBranch] = useState('')
  const [editBranchId, setEditBranchId] = useState<string | null>(null)
  const [editBranchName, setEditBranchName] = useState('')
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

      {/* El plan siempre a la vista: sin esto, el botón de pago solo salía en
          el aviso (prueba o por vencer) y quien quería pagar antes no tenía
          dónde. La pantalla de bloqueo y el aviso siguen existiendo. */}
      {esDueno && s.settings?.plan && (
        <>
          <div style={sectionStyle}>Mi plan</div>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '13px 15px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>
            {s.settings.plan.status === 'TRIAL' ? (
              <>
                Prueba gratis: {s.settings.plan.daysLeft === 1 ? 'queda 1 día' : `quedan ${s.settings.plan.daysLeft} días`}.
                Después, $ 59.900 al mes.
              </>
            ) : s.settings.plan.status === 'ACTIVE' && s.settings.plan.paidUntil ? (
              <>
                Plan pagado, vigente hasta el{' '}
                <b>
                  {new Date(s.settings.plan.paidUntil).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </b>{' '}
                ({s.settings.plan.daysLeft === 1 ? '1 día' : `${s.settings.plan.daysLeft} días`}). Cada pago suma 30 días.
              </>
            ) : s.settings.plan.status === 'ACTIVE' ? (
              <>Plan activo.</>
            ) : (
              <>Plan suspendido. Escríbenos a ventorypos@gmail.com para reactivarlo.</>
            )}
          </div>
          {s.settings.plan.status !== 'SUSPENDED' &&
            (s.settings.pagoEnLinea ? (
              <button
                onClick={s.pagarPlan}
                className="v-hover-primary"
                style={{ width: '100%', height: 44, marginTop: 10, borderRadius: 11, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
              >
                Pagar mi plan · $ 59.900 (suma 30 días)
              </button>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
                Para activar o renovar tu plan escríbenos a ventorypos@gmail.com.
              </div>
            ))}
        </>
      )}

      {esDueno && (
        <>
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

      <div style={sectionStyle}>Notificaciones</div>
      <button
        onClick={() => setResumenDiario(!resumenDiario)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 11,
          border: `1.5px solid ${resumenDiario ? '#6366F1' : 'var(--border)'}`,
          background: resumenDiario ? '#EEF0FE' : 'var(--surface)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 20, height: 20, borderRadius: 6, flex: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: resumenDiario ? '#6366F1' : 'var(--input)',
            border: resumenDiario ? 'none' : '1.5px solid var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 800,
          }}
        >
          {resumenDiario ? '✓' : ''}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>Resumen del día por correo</span>
          <span style={{ display: 'block', fontSize: 12.3, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
            Ventas, utilidad, cierre de caja y compras, cada noche
          </span>
        </span>
      </button>

      <button
        onClick={() => setAvisoStock(!avisoStock)}
        style={{
          marginTop: 8,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 11,
          border: `1.5px solid ${avisoStock ? '#6366F1' : 'var(--border)'}`,
          background: avisoStock ? '#EEF0FE' : 'var(--surface)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 20, height: 20, borderRadius: 6, flex: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: avisoStock ? '#6366F1' : 'var(--input)',
            border: avisoStock ? 'none' : '1.5px solid var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 800,
          }}
        >
          {avisoStock ? '✓' : ''}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>Avisar qué hay que reponer</span>
          <span style={{ display: 'block', fontSize: 12.3, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
            Incluye en el mismo correo lo agotado y lo que está por acabarse
          </span>
        </span>
      </button>

      <label style={{ ...fieldLabelStyle, marginTop: 12 }}>Correo donde llega el resumen</label>
      <input
        value={correoAviso}
        onChange={(e) => setCorreoAviso(e.target.value)}
        type="email"
        placeholder="Si lo dejas vacío, llega al correo del administrador"
        style={textInputStyle}
      />

      <button
        onClick={async () => {
          setProbando(true)
          await s.probarNotificacion()
          setProbando(false)
        }}
        disabled={probando}
        className="v-hover-bg"
        style={{ ...rowBtnStyle, marginTop: 10, opacity: probando ? 0.6 : 1, cursor: probando ? 'wait' : 'pointer' }}
      >
        {probando ? 'Enviando…' : 'Enviarme una prueba ahora'}
        <span style={{ color: '#6366F1' }}>→</span>
      </button>
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8', lineHeight: 1.55 }}>
        El resumen se envía cada noche después del cierre. Guarda los ajustes antes de probar.
      </div>
        </>
      )}

      <div style={sectionStyle}>Impresora de tickets</div>
      {printerState ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icono n="impresora" tam={16} />
              Conectada por {printerState === 'usb' ? 'USB' : 'Bluetooth'}
            </span>
          </div>
          <button
            onClick={async () => {
              try {
                await testPrint(s.settings?.name ?? 'Ventory')
                s.toast('Prueba enviada a la impresora')
              } catch (e) {
                s.toast(e instanceof Error ? e.message : 'No se pudo imprimir')
              }
            }}
            style={{ height: 38, padding: '0 12px', borderRadius: 10, background: '#EEF0FE', color: '#4338CA', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Probar
          </button>
          <button
            onClick={() => {
              forgetPrinter()
              setPrinterState(null)
              s.toast('Impresora olvidada')
            }}
            style={{ height: 38, padding: '0 12px', borderRadius: 10, background: '#FDECEC', color: '#C9433B', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Olvidar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={async () => {
              try {
                await connectUsb()
                setPrinterState('usb')
                s.toast('Impresora USB conectada')
              } catch (e) {
                s.toast(e instanceof Error ? e.message : 'No se pudo conectar')
              }
            }}
            style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Conectar USB
          </button>
          <button
            onClick={async () => {
              try {
                await connectBt()
                setPrinterState('bt')
                s.toast('Impresora Bluetooth conectada')
              } catch (e) {
                s.toast(e instanceof Error ? e.message : 'No se pudo conectar')
              }
            }}
            style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Conectar Bluetooth
          </button>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8' }}>
        Para impresoras térmicas de tickets (58/80 mm) en Chrome o Edge. Sin impresora conectada,
        imprimir usa el diálogo del navegador.
      </div>

      {esDueno && (
        <>
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
        </>
      )}

      {s.isAdmin && (
        <>
          <div style={sectionStyle}>Sucursales</div>
          {s.branches.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {editBranchId === b.id ? (
                <>
                  <input
                    value={editBranchName}
                    onChange={(e) => setEditBranchName(e.target.value)}
                    style={{ ...textInputStyle, flex: 1 }}
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (editBranchName.trim()) await s.renameBranch(b.id, editBranchName.trim())
                      setEditBranchId(null)
                    }}
                    style={{ height: 38, padding: '0 12px', borderRadius: 10, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    Guardar
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => s.setBranch(b.id)}
                    className="v-hover-bg"
                    style={{
                      flex: 1, height: 40, borderRadius: 10, textAlign: 'left', padding: '0 12px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                      border: s.activeBranchId === b.id ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
                      background: s.activeBranchId === b.id ? '#EEF0FE' : 'var(--surface)',
                      color: s.activeBranchId === b.id ? '#4338CA' : 'var(--text)',
                    }}
                  >
                    {b.name} {s.activeBranchId === b.id && '· activa en este equipo'}
                  </button>
                  <button
                    onClick={() => {
                      setEditBranchId(b.id)
                      setEditBranchName(b.name)
                    }}
                    title="Renombrar"
                    aria-label="Renombrar sucursal"
                    style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icono n="lapiz" tam={15} />
                  </button>
                </>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="Nueva sucursal (ej. Bodega, Local 2)…"
              style={{ ...textInputStyle, flex: 1 }}
            />
            <button
              onClick={async () => {
                if (newBranch.trim()) {
                  await s.addBranch(newBranch.trim())
                  setNewBranch('')
                }
              }}
              style={{ height: 38, padding: '0 14px', borderRadius: 10, background: '#EEF0FE', color: '#4338CA', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Crear
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8' }}>
            La sucursal activa es donde se abre la caja en este equipo. Cada sucursal tiene su propio inventario y turnos.
          </div>

          <div style={sectionStyle}>Cuenta</div>
          {esDueno && (
            <button onClick={() => s.openModal('usuarios')} className="v-hover-bg" style={rowBtnStyle}>
              Gestión de usuarios <span style={{ color: '#6366F1' }}>→</span>
            </button>
          )}
          <button onClick={() => s.openModal('auditoria')} className="v-hover-bg" style={{ ...rowBtnStyle, marginTop: 8 }}>
            Registro de actividad <span style={{ color: '#6366F1' }}>→</span>
          </button>
        </>
      )}

      {esDueno && (
        <>
          <div style={sectionStyle}>Exportar datos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(
              [
                ['sales', 'Ventas (CSV)'],
                ['products', 'Inventario (CSV)'],
                ['customers', 'Clientes (CSV)'],
                ['purchases', 'Compras (CSV)'],
              ] as const
            ).map(([t, label]) => (
              <a
                key={t}
                href={`/api/export?type=${t}`}
                download
                className="v-hover-bg"
                style={{ ...rowBtnStyle, height: 40, fontSize: 13, textDecoration: 'none', justifyContent: 'center' }}
              >
                <Icono n="descarga" tam={15} />
                {label}
              </a>
            ))}
          </div>
          <a
            href="/api/export?type=backup"
            download
            className="v-hover-bg"
            style={{ ...rowBtnStyle, marginTop: 8, textDecoration: 'none' }}
          >
            Respaldo completo del negocio (JSON)
            <span style={{ color: '#6366F1', display: 'inline-flex' }}>
              <Icono n="descarga" tam={16} />
            </span>
          </a>
          <div style={{ marginTop: 8, fontSize: 12.5, color: '#94A3B8' }}>
            Los CSV abren en Excel. El respaldo incluye productos, clientes, ventas, compras y caja.
          </div>
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

      {/* Los campos que guarda este botón son del dueño; el encargado no los
          ve (tema e impresora se aplican al instante, sin guardar) */}
      {esDueno && (
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
              notifyDailySummary: resumenDiario,
              notifyLowStock: avisoStock,
              notifyEmail: correoAviso.trim(),
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
      )}
    </Modal>
  )
}
