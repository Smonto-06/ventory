// Encabezado y pie compartidos por las páginas públicas, para que la
// página de inicio, el centro de ayuda y las legales se vean como un
// mismo sitio y no como tres páginas sueltas.

import Link from 'next/link'
import Image from 'next/image'
import { Icono } from '../Icono'

const CORREO = 'ventorypos@gmail.com'

const contenedor: React.CSSProperties = { maxWidth: 1140, margin: '0 auto', width: '100%' }

export function Encabezado({ enlaces = true }: { enlaces?: boolean }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          ...contenedor,
          height: 70,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 clamp(18px,5vw,36px)',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>
          <Image src="/brand/ventory-logo.png" alt="Ventory" width={126} height={33} priority />
        </Link>

        {enlaces && (
          <nav
            className="v-pub-ocultar-movil"
            style={{ display: 'flex', alignItems: 'center', gap: 26, marginLeft: 26, fontSize: 14.5, fontWeight: 600 }}
          >
            <a href="/#funciones" className="v-pub-nav">
              Funciones
            </a>
            <a href="/#reportes" className="v-pub-nav">
              Reportes
            </a>
            <a href="/#precio" className="v-pub-nav">
              Precio
            </a>
            <Link href="/ayuda" className="v-pub-nav">
              Ayuda
            </Link>
          </nav>
        )}

        <div style={{ flex: 1 }} />

        <Link
          href="/login"
          className="v-pub-nav"
          style={{ fontWeight: 600, fontSize: 14.5, padding: '0 6px' }}
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="v-pub-btn-primario"
          style={{
            height: 42,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '0 17px',
            borderRadius: 11,
            background: 'var(--acento)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14.5,
            textDecoration: 'none',
            boxShadow: '0 10px 22px -14px rgba(79,70,229,.9)',
          }}
        >
          Prueba gratis
        </Link>
      </div>
    </header>
  )
}

const tituloColumna: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '.9px',
  textTransform: 'uppercase',
  color: 'var(--text)',
  marginBottom: 14,
}

const enlacePie: React.CSSProperties = {
  color: 'var(--muted)',
  textDecoration: 'none',
  fontSize: 14.2,
  lineHeight: 2,
  display: 'block',
}

export function Pie() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ ...contenedor, padding: 'clamp(40px,6vw,60px) clamp(18px,5vw,36px) 30px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px,1.4fr) repeat(auto-fit,minmax(150px,1fr))',
            gap: 'clamp(28px,4vw,48px)',
          }}
        >
          <div>
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={118} height={31} />
            <p style={{ fontSize: 14.2, color: 'var(--muted)', lineHeight: 1.75, margin: '14px 0 0', maxWidth: 300 }}>
              Punto de venta, inventario y caja para negocios en Colombia. Precios en pesos, IVA
              incluido y todo desde el navegador.
            </p>
            <a
              href={`mailto:${CORREO}`}
              className="v-pub-nav"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 16,
                fontSize: 14.2,
                fontWeight: 600,
              }}
            >
              <Icono n="correo" tam={16} />
              {CORREO}
            </a>
          </div>

          <div>
            <div style={tituloColumna}>Producto</div>
            <a href="/#funciones" className="v-pub-nav" style={enlacePie}>
              Funciones
            </a>
            <a href="/#reportes" className="v-pub-nav" style={enlacePie}>
              Reportes
            </a>
            <a href="/#precio" className="v-pub-nav" style={enlacePie}>
              Precio
            </a>
            <Link href="/register" className="v-pub-nav" style={enlacePie}>
              Crear cuenta
            </Link>
          </div>

          <div>
            <div style={tituloColumna}>Soporte</div>
            <Link href="/ayuda" className="v-pub-nav" style={enlacePie}>
              Centro de ayuda
            </Link>
            <a href="/ayuda#primeros-pasos" className="v-pub-nav" style={enlacePie}>
              Primeros pasos
            </a>
            <a href={`mailto:${CORREO}`} className="v-pub-nav" style={enlacePie}>
              Escríbenos
            </a>
            <Link href="/login" className="v-pub-nav" style={enlacePie}>
              Entrar al sistema
            </Link>
          </div>

          <div>
            <div style={tituloColumna}>Legal</div>
            <Link href="/terminos" className="v-pub-nav" style={enlacePie}>
              Términos de servicio
            </Link>
            <Link href="/privacidad" className="v-pub-nav" style={enlacePie}>
              Tratamiento de datos
            </Link>
          </div>
        </div>

        <div
          style={{
            marginTop: 'clamp(28px,4vw,44px)',
            paddingTop: 22,
            borderTop: '1px solid var(--linea)',
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13.4,
            color: 'var(--muted)',
          }}
        >
          <span>© {new Date().getFullYear()} Ventory. Todos los derechos reservados.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icono n="escudo" tam={15} />
            Tus datos son solo tuyos y puedes exportarlos cuando quieras
          </span>
        </div>
      </div>
    </footer>
  )
}
