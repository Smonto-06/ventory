'use client'

// Shell de la aplicación: tema, toast, sidebar de administración y conmutador
// de pantallas — estructura 1:1 con el prototipo (docs/prototype).

import { useEffect, useState } from 'react'
import { useApp, Screen } from './store'
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
    default:
      return null
  }
}

function Sidebar({ narrow }: { narrow: boolean }) {
  const s = useApp()

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
    { id: 'movimientos', label: 'Movimientos', screen: 'movimientos', adminOnly: true },
    { id: 'reportes', label: 'Reportes', screen: 'reportes', adminOnly: true },
    { id: 'clientes', label: 'Clientes', screen: 'clientes' },
    { id: 'cierre', label: 'Cerrar caja', onClick: () => s.go('cierre') },
    { id: 'ajustes', label: 'Ajustes', adminOnly: true, onClick: () => s.openModal('ajustes') },
  ]

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
            : { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 12, flex: 1 }
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

// Bloqueo suave: prueba vencida o plan suspendido — se puede ver el aviso,
// contactar y cerrar sesión; las operaciones quedan deshabilitadas.
function PlanBlockedOverlay() {
  const s = useApp()
  const suspended = s.settings?.plan?.status === 'SUSPENDED'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 18, padding: 28, boxShadow: '0 30px 60px -30px rgba(15,25,23,.5)', animation: 'vpop .25s ease', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FDF4E5', color: '#B4740A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>
          {suspended ? '⏸' : '⏰'}
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, letterSpacing: '-.3px' }}>
          {suspended ? 'Tu plan está suspendido' : 'Tu prueba gratis terminó'}
        </h2>
        <div style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.55 }}>
          Tus datos están guardados y seguros. Para {suspended ? 'reactivar tu plan' : 'seguir vendiendo con Ventory'},
          escríbenos y activamos tu cuenta el mismo día:
        </div>
        <a
          href="mailto:ventorypos@gmail.com?subject=Activar%20mi%20plan%20de%20Ventory"
          style={{ display: 'block', marginTop: 16, padding: '13px 16px', borderRadius: 12, background: '#EEF0FE', color: '#4338CA', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}
        >
          ventorypos@gmail.com
        </a>
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted)' }}>
          ¿Ya nos escribiste? Apenas activemos tu plan, recarga esta página.
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
            {s.settings?.plan?.status === 'TRIAL' && !s.settings.plan.blocked && (
              <div data-no-print="true" style={{ background: '#FDF4E5', borderBottom: '1px solid #F3DCB0', color: '#8A6B2E', fontWeight: 700, fontSize: 13, padding: '9px 16px', textAlign: 'center' }}>
                Prueba gratis: {s.settings.plan.daysLeft === 1 ? 'queda 1 día' : `quedan ${s.settings.plan.daysLeft} días`} · Para activar tu
                plan escríbenos con el botón Contáctanos
              </div>
            )}
            {screens[s.screen]}
          </div>
        </div>
      ) : (
        screens[s.screen]
      )}

      {!s.loading && s.settings?.plan?.blocked && <PlanBlockedOverlay />}
      <Modals />
    </div>
  )
}
