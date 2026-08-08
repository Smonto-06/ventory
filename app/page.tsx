import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Icono, type NombreIcono } from '@/components/Icono'
import { Encabezado, Pie } from '@/components/publico/Cascaron'
import './app/ventory.css'
import './publico.css'

// Página comercial pública. Si ya hay sesión, se entra directo al sistema.

export const metadata = {
  title: 'Ventory — Punto de venta e inventario para tu negocio',
  description:
    'Vende, controla tu inventario y cuadra la caja desde cualquier dispositivo. Funciona sin internet. Prueba gratis 15 días.',
  alternates: { canonical: '/' },
}

// Datos estructurados para los buscadores: le dicen a Google qué es Ventory
// (un software de punto de venta), cuánto vale y que hay prueba gratis.
const DATOS_ESTRUCTURADOS = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ventory',
  description:
    'Sistema de punto de venta e inventario para negocios colombianos: ventas, caja, fiados, compras y reportes desde cualquier dispositivo, incluso sin internet.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'es-CO',
  offers: {
    '@type': 'Offer',
    price: '49900',
    priceCurrency: 'COP',
    description: 'Plan mensual. Prueba gratis de 15 días sin tarjeta.',
  },
}

// Precio mostrado en la página. Para cambiarlo, edita solo esta línea.
const PRECIO_MENSUAL = '$ 49.900'
const CORREO = 'ventorypos@gmail.com'

const FUNCIONES: Array<{ titulo: string; texto: string; icono: NombreIcono }> = [
  {
    icono: 'carrito',
    titulo: 'Cobra en segundos',
    texto:
      'Busca por nombre o escanea el código de barras. Efectivo, tarjeta, transferencia, pago combinado o fiado, con el cambio calculado y la factura lista para imprimir.',
  },
  {
    icono: 'caja',
    titulo: 'El inventario nunca se descuadra',
    texto:
      'Cada venta, compra, devolución y ajuste mueve el stock en el mismo instante. No existe un botón de "sincronizar": si la venta quedó registrada, el inventario ya bajó.',
  },
  {
    icono: 'recibo',
    titulo: 'La caja cuadra todos los días',
    texto:
      'Cuentas el efectivo, el sistema calcula lo que debería haber y te muestra la diferencia. Al cerrar imprimes el informe del turno con el desglose por método de pago.',
  },
  {
    icono: 'senal',
    titulo: 'Sigue vendiendo sin internet',
    texto:
      'Si se cae la conexión, el punto de venta no se detiene. Las ventas se guardan en el equipo y se envían solas cuando vuelve la señal.',
  },
  {
    icono: 'billetera',
    titulo: 'Fía sin perder la cuenta',
    texto:
      'Ventas a crédito con el saldo de cada cliente al día, abonos con su recibo y el historial completo. Sabes siempre quién te debe y cuánto.',
  },
  {
    icono: 'tendencia',
    titulo: 'Sabes cuánto ganas, no solo cuánto vendes',
    texto:
      'Reportes por día, semana, mes o rango, con utilidad real —ventas menos costo menos gastos— y comparación contra el período anterior.',
  },
]

const RESPALDO: Array<{ titulo: string; texto: string; icono: NombreIcono }> = [
  { icono: 'dinero', titulo: 'Pensado para Colombia', texto: 'Pesos y IVA incluido en el precio' },
  { icono: 'senal', titulo: 'Resiste caídas de red', texto: 'El mostrador nunca se detiene' },
  { icono: 'candado', titulo: 'Datos aislados', texto: 'Cada negocio ve solo lo suyo' },
  { icono: 'descarga', titulo: 'Sin quedar atrapado', texto: 'Exporta todo cuando quieras' },
]

const MOVIL = [
  { icono: 'monitor' as NombreIcono, texto: 'Computador, tablet y celular con la misma cuenta' },
  { icono: 'celular' as NombreIcono, texto: 'Se instala como aplicación en la pantalla de inicio' },
  { icono: 'codigo' as NombreIcono, texto: 'Escaneo con lector USB o con la cámara del celular' },
  { icono: 'impresora' as NombreIcono, texto: 'Impresión directa en térmica de 58 y 80 mm' },
]

const REPORTES = [
  'Ventas por hora, por método de pago y por producto',
  'Utilidad real después del costo de la mercancía y los gastos',
  'Comparación contra el período anterior',
  'Historial de turnos cerrados con sus diferencias',
]

const PASOS = [
  { t: 'Crea tu cuenta', d: 'En un minuto y sin tarjeta de crédito. Empiezas con 15 días gratis.' },
  { t: 'Sube tus productos', d: 'Uno a uno, o todos juntos importando tu lista desde Excel.' },
  { t: 'Abre la caja y vende', d: 'Desde el computador, la tablet o el celular. La guía del panel te acompaña.' },
]

const INCLUYE: Array<{ t: string; icono: NombreIcono }> = [
  { icono: 'carrito', t: 'Punto de venta con código de barras' },
  { icono: 'caja', t: 'Inventario y kardex por producto' },
  { icono: 'documento', t: 'Compras y proveedores' },
  { icono: 'billetera', t: 'Clientes y ventas a crédito' },
  { icono: 'recibo', t: 'Caja con cierre e informe imprimible' },
  { icono: 'tendencia', t: 'Reportes de ventas y utilidad' },
  { icono: 'sucursal', t: 'Varias sucursales o bodegas' },
  { icono: 'usuarios', t: 'Usuarios con permisos por rol' },
  { icono: 'senal', t: 'Funciona sin internet' },
  { icono: 'impresora', t: 'Impresión en térmica 58 y 80 mm' },
  { icono: 'descarga', t: 'Exportar a Excel y respaldo completo' },
  { icono: 'escudo', t: 'Actualizaciones y soporte incluidos' },
]

const PREGUNTAS = [
  {
    p: '¿Necesito instalar algo?',
    r: 'No. Ventory funciona en el navegador. Si quieres que abra como una aplicación, desde Chrome usas "Instalar aplicación" y queda con su ícono en la pantalla de inicio.',
  },
  {
    p: '¿Qué pasa con mis datos si dejo de usarlo?',
    r: 'Son tuyos. En cualquier momento descargas tus ventas, inventario, clientes y compras en Excel, o un respaldo completo del negocio en un solo archivo.',
  },
  {
    p: '¿Sirve si vendo por peso o al granel?',
    r: 'Sí. Marcas el producto como vendido por kilo y pones el precio por kilo; al venderlo digitas el peso en un teclado numérico y el sistema calcula el valor y descuenta el inventario en kilos.',
  },
  {
    p: '¿Puedo tener empleados con acceso limitado?',
    r: 'Sí. El rol Cajero puede vender pero no ve reportes, costos ni auditoría, ni puede ajustar inventario. El rol Administrador tiene acceso completo.',
  },
]

/* ── estilos base ── */
const seccion: React.CSSProperties = { padding: 'clamp(60px,9vw,104px) clamp(18px,5vw,36px)' }
const contenedor: React.CSSProperties = { maxWidth: 1140, margin: '0 auto', width: '100%' }

const etiqueta: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  color: 'var(--acento)',
}
const h2Style: React.CSSProperties = {
  fontSize: 'clamp(27px,3.7vw,40px)',
  fontWeight: 700,
  letterSpacing: '-1px',
  lineHeight: 1.15,
  margin: '14px 0 0',
  textWrap: 'balance',
}
const parrafo: React.CSSProperties = {
  fontSize: 16.5,
  color: 'var(--muted)',
  lineHeight: 1.75,
  margin: '18px 0 0',
}
const btnPrimario: React.CSSProperties = {
  height: 54,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  padding: '0 26px',
  borderRadius: 13,
  background: 'var(--acento)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  textDecoration: 'none',
  boxShadow: '0 16px 34px -18px rgba(79,70,229,.95)',
}
const btnSecundario: React.CSSProperties = {
  height: 54,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  padding: '0 24px',
  borderRadius: 13,
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 16,
  textDecoration: 'none',
}
const tarjeta: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 'clamp(22px,2.6vw,28px)',
}
const casilla: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 13,
  background: 'var(--acento-suave)',
  color: 'var(--acento)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/* Marco de navegador para presentar las capturas: las hace leer como
   producto real y no como una imagen suelta pegada en la página. */
function Ventana({
  src,
  alt,
  titulo,
  prioridad = false,
}: {
  src: string
  alt: string
  titulo: string
  prioridad?: boolean
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: '0 50px 90px -50px rgba(15,23,42,.5), 0 8px 20px -14px rgba(15,23,42,.2)',
      }}
    >
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '0 14px',
          background: '#f8fafc',
          borderBottom: '1px solid var(--linea)',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e8f0' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e8f0' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e8f0' }} />
        <span
          style={{
            marginLeft: 12,
            flex: 1,
            maxWidth: 320,
            height: 22,
            borderRadius: 7,
            background: '#fff',
            border: '1px solid var(--linea)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: 11.5,
            color: '#94a3b8',
            fontWeight: 600,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {titulo}
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={2080}
        height={1300}
        priority={prioridad}
        sizes="(max-width: 1180px) 100vw, 1080px"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </div>
  )
}

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/app')

  return (
    <div className="vapp v-pub" data-theme="light">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ESTRUCTURADOS) }}
      />
      <div style={{ background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>
        <Encabezado />

        {/* ══ Portada ══ */}
        <section
          className="v-pub-reticula"
          style={{
            ...seccion,
            paddingTop: 'clamp(48px,7vw,86px)',
            paddingBottom: 'clamp(34px,5vw,56px)',
            background:
              'radial-gradient(1200px 560px at 50% -180px, rgba(99,102,241,.14) 0%, rgba(246,248,251,0) 70%)',
          }}
        >
          <div style={{ ...contenedor, textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                background: 'var(--surface)',
                border: '1px solid var(--acento-borde)',
                color: 'var(--acento-fuerte)',
                fontWeight: 700,
                fontSize: 13,
                padding: '8px 16px',
                borderRadius: 99,
                boxShadow: '0 6px 16px -12px rgba(79,70,229,.6)',
              }}
            >
              <span
                style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', flex: 'none' }}
              />
              15 días gratis · sin tarjeta de crédito
            </span>

            <h1
              style={{
                fontSize: 'clamp(34px,5.6vw,62px)',
                fontWeight: 700,
                letterSpacing: '-2px',
                lineHeight: 1.05,
                margin: '24px 0 0',
                textWrap: 'balance',
              }}
            >
              El punto de venta que{' '}
              <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
                <span style={{ position: 'relative', zIndex: 1, color: 'var(--acento)' }}>
                  no te descuadra
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-2%',
                    right: '-2%',
                    bottom: '.1em',
                    height: '.22em',
                    background: 'rgba(99,102,241,.2)',
                    borderRadius: 4,
                  }}
                />
              </span>{' '}
              el inventario
            </h1>

            <p
              style={{
                fontSize: 'clamp(16.5px,1.9vw,19.5px)',
                color: 'var(--muted)',
                lineHeight: 1.7,
                maxWidth: 650,
                margin: '22px auto 0',
                textWrap: 'balance',
              }}
            >
              Vende, controla tu stock y cuadra la caja desde el computador, la tablet o el celular.
              Sigue funcionando aunque se caiga el internet.
            </p>

            <div style={{ display: 'flex', gap: 13, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
              <Link href="/register" className="v-pub-btn-primario" style={btnPrimario}>
                Empezar gratis
                <Icono n="flecha" tam={18} />
              </Link>
              <a href="#precio" className="v-pub-btn-borde" style={btnSecundario}>
                Ver precio
              </a>
            </div>

            <div style={{ marginTop: 'clamp(40px,6vw,64px)' }}>
              <Ventana
                src="/landing/pos.webp"
                alt="Pantalla de punto de venta de Ventory con el carrito y el total de la compra"
                titulo="Ventory · Punto de Venta"
                prioridad
              />
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--muted)',
                  marginTop: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Icono n="lupa" tam={14} />
                Pantallas reales del sistema, no ilustraciones
              </div>
            </div>
          </div>
        </section>

        {/* ══ Franja de respaldo ══ */}
        <section style={{ padding: '0 clamp(18px,5vw,36px) clamp(48px,7vw,80px)' }}>
          <div
            style={{
              ...contenedor,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(214px,1fr))',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            {RESPALDO.map((r) => (
              <div
                key={r.titulo}
                style={{
                  background: 'var(--surface)',
                  padding: '22px 24px',
                  display: 'flex',
                  gap: 13,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color: 'var(--acento)', marginTop: 1 }}>
                  <Icono n={r.icono} tam={20} />
                </span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.2px' }}>{r.titulo}</div>
                  <div style={{ fontSize: 13.4, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
                    {r.texto}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ Funciones ══ */}
        <section id="funciones" style={{ ...seccion, background: 'var(--surface)', scrollMarginTop: 70 }}>
          <div style={contenedor}>
            <div style={{ maxWidth: 720 }}>
              <span style={etiqueta}>Funciones</span>
              <h2 style={h2Style}>Todo lo que un negocio necesita, sin complicaciones</h2>
              <p style={parrafo}>
                No es un catálogo de módulos sueltos: cada parte alimenta a la siguiente, de modo que
                una sola venta ya actualiza inventario, caja, reportes y el saldo del cliente.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
                gap: 18,
                marginTop: 'clamp(34px,4vw,52px)',
              }}
            >
              {FUNCIONES.map((f) => (
                <article key={f.titulo} className="v-pub-tarjeta" style={{ ...tarjeta, background: 'var(--bg)' }}>
                  <div style={casilla}>
                    <Icono n={f.icono} tam={23} />
                  </div>
                  <h3 style={{ fontSize: 17.5, fontWeight: 700, letterSpacing: '-.35px', margin: '16px 0 9px' }}>
                    {f.titulo}
                  </h3>
                  <p style={{ fontSize: 14.6, color: 'var(--muted)', lineHeight: 1.72, margin: 0 }}>{f.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══ En cualquier dispositivo ══ */}
        <section style={seccion}>
          <div
            className="v-pub-columnas"
            style={{
              ...contenedor,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
              gap: 'clamp(32px,5vw,68px)',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={etiqueta}>En cualquier pantalla</span>
              <h2 style={h2Style}>En el mostrador o en la mano</h2>
              <p style={parrafo}>
                Ventory se adapta a la pantalla: en el computador aprovecha todo el espacio con el
                carrito al lado; en el celular deja el botón de cobro siempre a la vista, sin zoom ni
                desplazamientos laterales.
              </p>
              <ul style={{ margin: '26px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 15 }}>
                {MOVIL.map((m) => (
                  <li key={m.texto} style={{ display: 'flex', gap: 13, alignItems: 'center', fontSize: 15.2 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'var(--acento-suave)',
                        color: 'var(--acento)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Icono n={m.icono} tam={17} />
                    </span>
                    {m.texto}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 296,
                  borderRadius: 34,
                  padding: 9,
                  background: 'linear-gradient(160deg,#1e293b,#0f172a)',
                  boxShadow: '0 50px 80px -40px rgba(15,23,42,.6)',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 17,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 74,
                    height: 5,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,.28)',
                    zIndex: 2,
                  }}
                />
                <div style={{ borderRadius: 26, overflow: 'hidden', lineHeight: 0 }}>
                  <Image
                    src="/landing/movil.webp"
                    alt="Ventory funcionando en la pantalla de un celular"
                    width={580}
                    height={1190}
                    sizes="290px"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ Reportes ══ */}
        <section id="reportes" style={{ ...seccion, background: 'var(--surface)', scrollMarginTop: 70 }}>
          <div style={contenedor}>
            <div style={{ maxWidth: 720 }}>
              <span style={etiqueta}>Reportes</span>
              <h2 style={h2Style}>Toma decisiones con números, no con corazonadas</h2>
              <p style={parrafo}>
                Cuánto vendiste, a qué hora, con qué método de pago y qué productos se mueven. Y lo
                más importante: cuánta utilidad quedó después del costo de la mercancía y los gastos.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
                gap: '12px 26px',
                margin: '26px 0 clamp(34px,4vw,48px)',
                maxWidth: 900,
              }}
            >
              {REPORTES.map((r) => (
                <div key={r} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 14.8, lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--acento)', marginTop: 3 }}>
                    <Icono n="check" tam={16} grosor={2.2} />
                  </span>
                  {r}
                </div>
              ))}
            </div>

            <Ventana
              src="/landing/reportes.webp"
              alt="Pantalla de reportes con ventas por hora, métodos de pago y utilidad"
              titulo="Ventory · Reportes"
            />
          </div>
        </section>

        {/* ══ Cómo empezar ══ */}
        <section style={seccion}>
          <div style={contenedor}>
            <div style={{ maxWidth: 720 }}>
              <span style={etiqueta}>Puesta en marcha</span>
              <h2 style={h2Style}>Empezar toma menos de lo que crees</h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
                gap: 18,
                marginTop: 'clamp(32px,4vw,48px)',
              }}
            >
              {PASOS.map((p, i) => (
                <div key={p.t} style={{ ...tarjeta, position: 'relative', overflow: 'hidden' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: -14,
                      right: 12,
                      fontSize: 92,
                      fontWeight: 800,
                      lineHeight: 1,
                      color: 'var(--acento-suave)',
                      letterSpacing: '-4px',
                      userSelect: 'none',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 17.5, fontWeight: 700, letterSpacing: '-.35px' }}>{p.t}</div>
                    <div style={{ fontSize: 14.6, color: 'var(--muted)', marginTop: 9, lineHeight: 1.7 }}>{p.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ Precio ══ */}
        <section id="precio" style={{ ...seccion, background: 'var(--surface)', scrollMarginTop: 70 }}>
          <div style={{ ...contenedor, textAlign: 'center' }}>
            <span style={etiqueta}>Precio</span>
            <h2 style={{ ...h2Style, textAlign: 'center' }}>Un solo plan, todo incluido</h2>
            <p style={{ ...parrafo, maxWidth: 640, margin: '18px auto 0', textWrap: 'balance' }}>
              Sin instalación, sin permanencia y sin funciones bloqueadas por nivel.
            </p>

            <div
              style={{
                maxWidth: 620,
                margin: 'clamp(34px,4vw,50px) auto 0',
                background: 'var(--bg)',
                border: '1px solid var(--acento-borde)',
                borderRadius: 24,
                overflow: 'hidden',
                textAlign: 'left',
                boxShadow: '0 40px 80px -50px rgba(79,70,229,.6)',
              }}
            >
              <div
                style={{
                  padding: 'clamp(28px,4vw,38px)',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ ...etiqueta, letterSpacing: '1.6px' }}>Plan Ventory</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 9, marginTop: 12 }}>
                  <span style={{ fontSize: 'clamp(40px,6vw,56px)', fontWeight: 700, letterSpacing: '-2.4px' }}>
                    {PRECIO_MENSUAL}
                  </span>
                  <span style={{ fontSize: 16.5, color: 'var(--muted)', fontWeight: 600 }}>/ mes</span>
                </div>
                <div style={{ fontSize: 14.2, color: 'var(--muted)', marginTop: 8 }}>
                  Primeros 15 días gratis · cancela cuando quieras
                </div>
              </div>

              <div style={{ padding: 'clamp(26px,4vw,34px)' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(232px,1fr))',
                    gap: '13px 24px',
                  }}
                >
                  {INCLUYE.map((i) => (
                    <div key={i.t} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 14.4, lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--acento)', marginTop: 2 }}>
                        <Icono n={i.icono} tam={17} />
                      </span>
                      <span>{i.t}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="v-pub-btn-primario"
                  style={{
                    ...btnPrimario,
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: 30,
                    width: '100%',
                  }}
                >
                  Empezar mi prueba gratis
                  <Icono n="flecha" tam={18} />
                </Link>
                <div style={{ textAlign: 'center', fontSize: 13.4, color: 'var(--muted)', marginTop: 14 }}>
                  ¿Dudas antes de empezar?{' '}
                  <a href={`mailto:${CORREO}`} style={{ color: 'var(--acento)', fontWeight: 700, textDecoration: 'none' }}>
                    Escríbenos
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ Preguntas ══ */}
        <section style={seccion}>
          <div
            className="v-pub-columnas"
            style={{
              ...contenedor,
              display: 'grid',
              gridTemplateColumns: 'minmax(240px,.72fr) minmax(300px,1.28fr)',
              gap: 'clamp(28px,4vw,56px)',
              alignItems: 'start',
            }}
          >
            <div>
              <span style={etiqueta}>Preguntas</span>
              <h2 style={{ ...h2Style, fontSize: 'clamp(25px,3vw,34px)' }}>Lo que más nos preguntan</h2>
              <p style={{ ...parrafo, fontSize: 15.4 }}>
                Hay muchas más resueltas en el centro de ayuda, con el paso a paso de cada pantalla.
              </p>
              <Link
                href="/ayuda"
                className="v-pub-nav"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, fontWeight: 700, fontSize: 14.6, color: 'var(--acento)' }}
              >
                Ir al centro de ayuda
                <Icono n="flecha" tam={16} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PREGUNTAS.map((q) => (
                <details key={q.p} className="v-pub-faq" style={{ ...tarjeta, padding: '20px 22px' }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 15.6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                      letterSpacing: '-.2px',
                    }}
                  >
                    {q.p}
                    <span className="v-pub-chevron" style={{ color: 'var(--acento)' }}>
                      <Icono n="chevron" tam={18} />
                    </span>
                  </summary>
                  <p style={{ fontSize: 14.6, color: 'var(--muted)', lineHeight: 1.75, margin: '13px 0 0' }}>{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ══ Cierre ══ */}
        <section style={{ padding: '0 clamp(18px,5vw,36px) clamp(64px,8vw,96px)' }}>
          <div
            style={{
              ...contenedor,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 24,
              background: 'linear-gradient(140deg,#111c33 0%,#0f172a 55%,#1a1f47 100%)',
              padding: 'clamp(40px,6vw,72px) clamp(24px,5vw,64px)',
              textAlign: 'center',
            }}
          >
            <svg
              viewBox="0 0 400 120"
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.28 }}
            >
              <polyline
                points="0,104 40,88 80,94 120,62 160,72 200,40 240,52 280,24 320,34 360,12 400,20"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div style={{ position: 'relative' }}>
              <h2
                style={{
                  fontSize: 'clamp(26px,3.6vw,40px)',
                  fontWeight: 700,
                  letterSpacing: '-1.1px',
                  color: '#fff',
                  margin: 0,
                  textWrap: 'balance',
                }}
              >
                ¿Listo para dejar el cuaderno?
              </h2>
              <p
                style={{
                  fontSize: 16.5,
                  color: '#94a3b8',
                  lineHeight: 1.72,
                  maxWidth: 580,
                  margin: '18px auto 30px',
                }}
              >
                Crea tu cuenta y prueba Ventory con tus productos reales durante 15 días. Si tienes
                dudas, escríbenos: te ayudamos a montar tu inventario.
              </p>
              <div style={{ display: 'flex', gap: 13, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/register" className="v-pub-btn-primario" style={btnPrimario}>
                  Crear mi cuenta
                  <Icono n="flecha" tam={18} />
                </Link>
                <a
                  href={`mailto:${CORREO}`}
                  style={{
                    ...btnSecundario,
                    background: 'rgba(255,255,255,.07)',
                    border: '1.5px solid rgba(255,255,255,.2)',
                    color: '#fff',
                  }}
                >
                  <Icono n="correo" tam={18} />
                  Escríbenos
                </a>
              </div>
            </div>
          </div>
        </section>

        <Pie />
      </div>
    </div>
  )
}
