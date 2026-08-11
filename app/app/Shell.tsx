'use client'

// Shell de la aplicación: tema, toast, sidebar de administración y conmutador
// de pantallas — estructura 1:1 con el prototipo (docs/prototype).

import { useEffect, useState } from 'react'
import { useApp, Screen } from './store'
import { usePantallaCompleta } from './Pantalla'
import { Icono } from '@/components/Icono'
import { VLogo } from './ui'
import Modals from './Modals'

import PanelScreen from './screens/PanelScreen'
import PosScreen from './screens/PosScreen'
import CobroScreen from './screens/CobroScreen'
import ReceiptScreen from './screens/ReceiptScreen'
import TicketScreen from './screens/TicketScreen'
import CierreScreen from './screens/CierreScreen'
import EsperasScreen from './screens/EsperasScreen'
import CierreReciboScreen from './screens/CierreReciboScreen'
import CompraReciboScreen from './screens/CompraReciboScreen'
import DevolucionesScreen from './screens/DevolucionesScreen'
import ReciboAbonoScreen from './screens/ReciboAbonoScreen'
import ProductosScreen from './screens/ProductosScreen'
import VentasScreen from './screens/VentasScreen'
import ReportesScreen from './screens/ReportesScreen'
import ClientesScreen from './screens/ClientesScreen'
import ClientePerfilScreen from './screens/ClientePerfilScreen'
import ComprasScreen from './screens/ComprasScreen'
import NuevaCompraScreen from './screens/NuevaCompraScreen'
import MovimientosScreen from './screens/MovimientosScreen'
import ProveedoresScreen from './screens/ProveedoresScreen'
import CotizacionesScreen from './screens/CotizacionesScreen'
import CotizacionReciboScreen from './screens/CotizacionReciboScreen'

const ADMIN_SET: Screen[] = [
  'panel',
  'productos',
  'ventas',
  'reportes',
  'clientes',
  'compras',
  'movimientos',
  'proveedores',
  'clienteperfil',
  'cotizaciones',
]

export function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  useEffect(() => {
    const onR = () => setW(window.innerWidth)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])
  return w
}

function NavIcon({ id }: { id: string }) {
  switch (id) {
    case 'panel':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="5" height="5" rx="1.5" />
          <rect x="9" y="2" width="5" height="5" rx="1.5" />
          <rect x="2" y="9" width="5" height="5" rx="1.5" />
          <rect x="9" y="9" width="5" height="5" rx="1.5" />
        </svg>
      )
    case 'pos':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 13.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'productos':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="4" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2.5 7h11" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'compras':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="5" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 5V4a2.5 2.5 0 0 1 5 0v1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'proveedores':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 8V3.5a1 1 0 0 1 1-1H8l5.5 5.5-5 5L2.5 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="5.8" cy="5.8" r="1" fill="currentColor" />
        </svg>
      )
    case 'ventas':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="2.5" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 6h5M5.5 9h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'movimientos':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M5.5 12V4M5.5 4L3.5 6M5.5 4l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 4v8M10.5 12l-2-2M10.5 12l2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'reportes':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2.5" y="8" width="3" height="6" rx="1" />
          <rect x="6.5" y="4.5" width="3" height="9.5" rx="1" />
          <rect x="10.5" y="6.5" width="3" height="7.5" rx="1" />
        </svg>
      )
    case 'clientes':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.2" r="2.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 13.6c.6-2.4 2.6-3.7 5-3.7s4.4 1.3 5 3.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      )
    case 'cierre':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'ajustes':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 4.5h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="6" cy="4.5" r="1.7" fill="currentColor" />
          <circle cx="10" cy="11.5" r="1.7" fill="currentColor" />
        </svg>
      )
    case 'cotizaciones':
      return <Icono n="documento" tam={17} />
    case 'expandir':
      return <Icono n="expandir" tam={17} />
    case 'contraer':
      return <Icono n="contraer" tam={17} />
    case 'plataforma':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2.5 6h11M6 6v7.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'salir':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M6.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 13.5h2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 5l3 3-3 3M13 8H6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'ayuda':
      return (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6.3 6.2a1.75 1.75 0 1 1 2.3 1.7c-.4.15-.6.5-.6.9v.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r=".85" fill="currentColor" />
        </svg>
      )
    default:
      return null
  }
}

function Sidebar({ narrow }: { narrow: boolean }) {
  const s = useApp()
  const pantalla = usePantallaCompleta()

  const navBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '11px 14px',
    borderRadius: 10,
    fontSize: 14.5,
    fontWeight: active ? 700 : 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all .12s',
    whiteSpace: 'nowrap',
    flex: 'none',
    background: active ? 'var(--side-active-bg)' : 'transparent',
    color: active ? 'var(--side-active-text)' : 'var(--side-text)',
  })

  const items: Array<{ id: string; label: string; screen?: Screen; adminOnly?: boolean; onClick?: () => void }> = [
    { id: 'panel', label: 'Panel Principal', screen: 'panel' },
    { id: 'pos', label: 'Punto de Venta', screen: 'pos' },
    { id: 'productos', label: 'Productos', screen: 'productos' },
    { id: 'compras', label: 'Compras', screen: 'compras', adminOnly: true },
    { id: 'proveedores', label: 'Proveedores', screen: 'proveedores', adminOnly: true },
    { id: 'ventas', label: 'Ventas', screen: 'ventas' },
    { id: 'cotizaciones', label: 'Cotizaciones', screen: 'cotizaciones' },
    { id: 'movimientos', label: 'Movimientos', screen: 'movimientos', adminOnly: true },
    { id: 'reportes', label: 'Reportes', screen: 'reportes', adminOnly: true },
    { id: 'clientes', label: 'Clientes', screen: 'clientes' },
    { id: 'cierre', label: 'Cerrar caja', onClick: () => s.go('cierre') },
    { id: 'ajustes', label: 'Ajustes', adminOnly: true, onClick: () => s.openModal('ajustes') },
    { id: 'ayuda', label: 'Ayuda', onClick: () => window.open('/ayuda', '_blank', 'noopener') },
  ]

  // Terminales táctiles: sin teclado no se puede pulsar F11, así que la
  // pantalla completa necesita un botón. Solo aparece si el navegador la
  // soporta (Safari en iPhone no).
  if (pantalla.disponible) {
    items.push({
      id: pantalla.activa ? 'contraer' : 'expandir',
      label: pantalla.activa ? 'Salir de pantalla' : 'Pantalla completa',
      onClick: pantalla.alternar,
    })
  }

  // En celular la barra es una fila horizontal SIN el pie del escritorio:
  // el panel de plataforma y el cerrar sesión entran al final del menú para
  // que también existan en el teléfono.
  if (narrow) {
    if (s.settings?.isSuperAdmin) {
      items.push({ id: 'plataforma', label: 'Panel de plataforma', onClick: () => window.location.assign('/admin') })
    }
    items.push({ id: 'salir', label: 'Cerrar sesión', onClick: s.logout })
  }

  const isActive = (item: (typeof items)[number]) => {
    if (!item.screen) return false
    if (item.screen === 'clientes') return s.screen === 'clientes' || s.screen === 'clienteperfil'
    return s.screen === item.screen
  }

  return (
    <aside
      data-no-print="true"
      style={
        narrow
          ? {
              flex: 'none',
              width: '100%',
              background: 'var(--side-bg)',
              borderBottom: '1px solid var(--side-border)',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px 12px 8px',
            }
          : {
              flex: 'none',
              width: 238,
              background: 'var(--side-bg)',
              borderRight: '1px solid var(--side-border)',
              display: 'flex',
              flexDirection: 'column',
              padding: '18px 12px 14px',
              position: 'sticky',
              top: 0,
              height: '100vh',
            }
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EEF0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <VLogo size={20} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-.6px', color: 'var(--side-heading)' }}>Ventory</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.8px', color: '#64748B', textTransform: 'uppercase', padding: '14px 12px 0' }}>
        {s.settings?.name ?? ''}
      </div>
      <nav
        style={
          narrow
            ? { display: 'flex', flexDirection: 'row', gap: 4, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }
            : // minHeight 0 + overflowY: en pantallas bajitas el menú se desliza
              // con su propia barra y el pie (usuario, cerrar sesión, panel de
              // plataforma) queda fijo abajo, siempre visible
              { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 12, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }
        }
      >
        {items
          .filter((i) => !i.adminOnly || s.isAdmin)
          .map((item) => (
            <button
              key={item.id}
              onClick={item.onClick ?? (() => s.go(item.screen!))}
              style={navBtn(isActive(item))}
            >
              <NavIcon id={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
      </nav>
      {!narrow && (
        <div style={{ borderTop: '1px solid var(--side-border)', padding: '14px 12px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#10B981,#6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                flex: 'none',
              }}
            >
              {(s.me.name || '?')[0].toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.25, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--side-heading)' }}>{s.me.name}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{s.isAdmin ? 'Administrador' : 'Cajero'}</div>
            </div>
          </div>
          {s.settings?.isSuperAdmin && (
            <a
              href="/admin"
              style={{ display: 'block', marginTop: 12, fontSize: 13.5, color: '#94A3B8', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
            >
              Panel de plataforma →
            </a>
          )}
          <button
            onClick={s.logout}
            className="v-hover-logout"
            style={{ marginTop: 12, fontSize: 13.5, color: '#94A3B8', fontWeight: 600, cursor: 'pointer', padding: '0 0 4px' }}
          >
            Cerrar sesión →
          </button>
        </div>
      )}
    </aside>
  )
}

// Bloqueo suave: prueba o mensualidad vencida, o plan suspendido — se puede
// ver el aviso, pagar/contactar y cerrar sesión; las operaciones quedan
// deshabilitadas.
function PlanBlockedOverlay() {
  const s = useApp()
  const [pagando, setPagando] = useState(false)
  const plan = s.settings?.plan
  const suspended = plan?.status === 'SUSPENDED'
  const mensualidadVencida = plan?.status === 'ACTIVE'
  // El pago en línea aparece solo con las llaves de Wompi configuradas y para
  // el administrador (la cuenta suspendida se reactiva con soporte, no pagando)
  const puedePagar = !!s.settings?.pagoEnLinea && s.isAdmin && !suspended
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 18, padding: 28, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FDF4E5', color: '#B4740A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Icono n={suspended ? 'candado' : 'reloj'} tam={26} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, letterSpacing: '-.3px' }}>
          {suspended ? 'Tu plan está suspendido' : mensualidadVencida ? 'Tu mensualidad venció' : 'Tu prueba gratis terminó'}
        </h2>
        <div style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.55 }}>
          {puedePagar
            ? 'Tus datos están guardados y seguros. Paga tu mensualidad y sigues vendiendo de inmediato:'
            : `Tus datos están guardados y seguros. Para ${suspended ? 'reactivar tu plan' : 'seguir vendiendo con Ventory'}, escríbenos y activamos tu cuenta el mismo día:`}
        </div>
        {puedePagar && (
          <button
            onClick={() => {
              setPagando(true)
              s.pagarPlan().finally(() => setPagando(false))
            }}
            disabled={pagando}
            className="v-hover-primary"
            style={{ display: 'block', width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 12, background: pagando ? '#C7CDEC' : '#6366F1', color: '#fff', fontWeight: 800, fontSize: 15.5, cursor: pagando ? 'wait' : 'pointer', boxShadow: pagando ? 'none' : '0 8px 18px -8px #6366F1cc' }}
          >
            {pagando ? 'Abriendo el pago seguro…' : 'Pagar mi plan · $ 59.900'}
          </button>
        )}
        <a
          href="mailto:ventorypos@gmail.com?subject=Activar%20mi%20plan%20de%20Ventory"
          style={{ display: 'block', marginTop: puedePagar ? 10 : 16, padding: '13px 16px', borderRadius: 12, background: 'var(--bg)', color: '#4338CA', fontWeight: 800, fontSize: puedePagar ? 13.5 : 15, textDecoration: 'none' }}
        >
          {puedePagar ? '¿Prefieres otro medio? ventorypos@gmail.com' : 'ventorypos@gmail.com'}
        </a>
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted)' }}>
          {puedePagar
            ? s.settings?.pasarela === 'mercadopago'
              ? 'El pago es procesado por Mercado Pago: PSE, tarjeta o efectivo.'
              : 'El pago es procesado por Wompi (Bancolombia): Nequi, PSE o tarjeta.'
            : '¿Ya nos escribiste? Apenas activemos tu plan, recarga esta página.'}
        </div>
        <button
          onClick={s.logout}
          style={{ marginTop: 18, fontSize: 13.5, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}
          className="v-hover-underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// Aviso del plan: días de prueba restantes o mensualidad por vencer. Con las
// llaves de Wompi configuradas el aviso trae el botón de pago; sin ellas,
// invita a escribir al soporte (activación manual, como siempre).
function PlanBanner() {
  const s = useApp()
  const plan = s.settings?.plan
  if (!plan || plan.blocked) return null
  const esTrial = plan.status === 'TRIAL'
  const porVencer = plan.status === 'ACTIVE' && !!plan.paidUntil && (plan.daysLeft ?? 99) <= 5
  if (!esTrial && !porVencer) return null
  const dias = plan.daysLeft ?? 0
  const texto = esTrial
    ? `Prueba gratis: ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}`
    : `Tu mensualidad ${dias === 0 ? 'vence hoy' : dias === 1 ? 'vence mañana' : `vence en ${dias} días`}`
  const puedePagar = !!s.settings?.pagoEnLinea && s.isAdmin
  return (
    <div
      data-no-print="true"
      style={{ background: '#FDF4E5', borderBottom: '1px solid #F3DCB0', color: '#8A6B2E', fontWeight: 700, fontSize: 13, padding: '7px 16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}
    >
      <span>
        {texto}
        {!puedePagar && ' · Para activar tu plan escríbenos a ventorypos@gmail.com'}
      </span>
      {puedePagar && (
        <button
          onClick={s.pagarPlan}
          style={{ height: 30, padding: '0 13px', borderRadius: 9, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 6px 14px -6px #6366F1cc' }}
        >
          Pagar mi plan · $ 59.900
        </button>
      )}
    </div>
  )
}

// Aviso de conexión: sin internet o con operaciones pendientes de sincronizar
function OfflineBanner() {
  const s = useApp()
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const upd = () => setOnline(navigator.onLine)
    upd()
    window.addEventListener('online', upd)
    window.addEventListener('offline', upd)
    return () => {
      window.removeEventListener('online', upd)
      window.removeEventListener('offline', upd)
    }
  }, [])

  if (online && s.pendingCount === 0) return null
  return (
    <div
      data-no-print="true"
      style={{
        background: online ? '#EEF0FE' : '#FDF4E5',
        borderBottom: `1px solid ${online ? '#C7D0FB' : '#F3DCB0'}`,
        color: online ? '#4338CA' : '#8A6B2E',
        fontWeight: 700,
        fontSize: 13,
        padding: '9px 16px',
        textAlign: 'center',
      }}
    >
      {online
        ? `${s.pendingCount} operaci${s.pendingCount === 1 ? 'ón' : 'ones'} sin conexión pendiente${s.pendingCount === 1 ? '' : 's'} de sincronizar…`
        : `Sin conexión — puedes seguir vendiendo, comprando y creando productos${s.pendingCount ? ` (${s.pendingCount} pendiente${s.pendingCount === 1 ? '' : 's'})` : ''}, se enviará al volver el internet`}
    </div>
  )
}

export default function Shell() {
  const s = useApp()
  const w = useWindowWidth()
  const narrow = w < 880

  const screens: Record<Screen, React.ReactNode> = {
    panel: <PanelScreen />,
    pos: <PosScreen />,
    cobro: <CobroScreen />,
    receipt: <ReceiptScreen />,
    ticket: <TicketScreen />,
    cierre: <CierreScreen />,
    esperas: <EsperasScreen />,
    cotizaciones: <CotizacionesScreen />,
    cotizacionRecibo: <CotizacionReciboScreen />,
    devoluciones: <DevolucionesScreen />,
    reciboAbono: <ReciboAbonoScreen />,
    cierreRecibo: <CierreReciboScreen />,
    compraRecibo: <CompraReciboScreen />,
    productos: <ProductosScreen />,
    ventas: <VentasScreen />,
    reportes: <ReportesScreen />,
    clientes: <ClientesScreen />,
    clienteperfil: <ClientePerfilScreen />,
    compras: <ComprasScreen />,
    nuevacompra: <NuevaCompraScreen />,
    movimientos: <MovimientosScreen />,
    proveedores: <ProveedoresScreen />,
  }

  const inAdminShell = ADMIN_SET.includes(s.screen)

  return (
    <div className="vapp" data-theme={s.theme === 'oscuro' ? 'dark' : 'light'}>
      {s.toastMsg && (
        <div
          data-no-print="true"
          style={{
            position: 'fixed',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: '#0F172A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13.5,
            padding: '11px 18px',
            borderRadius: 12,
            boxShadow: '0 14px 34px -10px rgba(15,29,27,.6)',
            animation: 'vfade .25s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {s.toastMsg}
        </div>
      )}

      {s.loading ? (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
          <VLogo size={44} />
          <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 14.5 }}>Cargando Ventory…</div>
        </div>
      ) : inAdminShell ? (
        <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <Sidebar narrow={narrow} />
          <div style={{ flex: 1, minWidth: 'min(100%,320px)', display: 'flex', flexDirection: 'column' }}>
            <OfflineBanner />
            <PlanBanner />
            {screens[s.screen]}
          </div>
        </div>
      ) : (
        <>
          <OfflineBanner />
          {screens[s.screen]}
        </>
      )}

      {!s.loading && s.settings?.plan?.blocked && <PlanBlockedOverlay />}
      <Modals />
    </div>
  )
}
