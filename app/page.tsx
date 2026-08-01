import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import './app/ventory.css'

// Página comercial pública. Si ya hay sesión, se entra directo al sistema.

export const metadata = {
  title: 'Ventory — Punto de venta e inventario para tu negocio',
  description:
    'Vende, controla tu inventario y cuadra la caja desde cualquier dispositivo. Funciona sin internet. Prueba gratis 15 días.',
}

// Precio mostrado en la página. Para cambiarlo, edita solo esta línea.
const PRECIO_MENSUAL = '$ 49.900'

const BENEFICIOS = [
  {
    titulo: 'Vende en segundos',
    texto:
      'Busca por nombre o escanea el código de barras y cobra. Efectivo, tarjeta, transferencia, pago combinado o fiado — con el cambio calculado y la factura lista para imprimir.',
    icono: '🛒',
  },
  {
    titulo: 'El inventario nunca se descuadra',
    texto:
      'Cada venta, compra, devolución y ajuste mueve el stock en el mismo instante. No existe "sincronizar": si la venta quedó registrada, el inventario ya bajó.',
    icono: '📦',
  },
  {
    titulo: 'La caja cuadra todos los días',
    texto:
      'Cuentas el efectivo, el sistema calcula lo que debería haber y te muestra la diferencia. Al cerrar imprimes el informe del turno con las ventas por método de pago.',
    icono: '🧾',
  },
  {
    titulo: 'Sigue vendiendo sin internet',
    texto:
      'Si se cae la conexión, el punto de venta sigue funcionando. Las ventas se guardan en el equipo y se envían solas cuando vuelve la señal.',
    icono: '📶',
  },
  {
    titulo: 'Fía sin perder la cuenta',
    texto:
      'Registra ventas a crédito con el saldo de cada cliente al día, recibe abonos y entrega su recibo. Sabes siempre quién te debe y cuánto.',
    icono: '🤝',
  },
  {
    titulo: 'Sabes cuánto ganas, no solo cuánto vendes',
    texto:
      'Reportes por día, semana, mes o rango, con utilidad real (ventas menos costo menos gastos) y comparación contra el período anterior.',
    icono: '📈',
  },
]

const PASOS = [
  { n: '1', t: 'Crea tu cuenta', d: 'En un minuto y sin tarjeta de crédito.' },
  { n: '2', t: 'Sube tus productos', d: 'Uno a uno o importando tu lista desde Excel.' },
  { n: '3', t: 'Abre la caja y vende', d: 'Desde el computador, la tablet o el celular.' },
]

const INCLUYE = [
  'Punto de venta con código de barras',
  'Inventario y kardex por producto',
  'Compras y proveedores',
  'Clientes y ventas a crédito',
  'Caja con cierre e informe imprimible',
  'Reportes de ventas y utilidad',
  'Varias sucursales',
  'Usuarios con permisos (cajero/administrador)',
  'Funciona sin internet',
  'Impresión en térmica 58/80 mm',
  'Exportar a Excel y respaldo completo',
  'Actualizaciones y soporte incluidos',
]

const seccion: React.CSSProperties = { padding: 'clamp(56px,9vw,96px) clamp(20px,5vw,40px)' }
const contenedor: React.CSSProperties = { maxWidth: 1120, margin: '0 auto' }
const h2Style: React.CSSProperties = {
  fontSize: 'clamp(26px,4vw,36px)',
  fontWeight: 800,
  letterSpacing: '-.7px',
  margin: 0,
  textAlign: 'center',
  textWrap: 'balance',
}
const btnPrimario: React.CSSProperties = {
  height: 54,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 28px',
  borderRadius: 14,
  background: '#6366F1',
  color: '#fff',
  fontWeight: 800,
  fontSize: 16,
  textDecoration: 'none',
  boxShadow: '0 14px 30px -14px #6366F1',
}
const btnSecundario: React.CSSProperties = {
  height: 54,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 24px',
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 16,
  textDecoration: 'none',
}

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/app')

  return (
    <div className="vapp" data-theme="light">
      <div style={{ background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>
        {/* ── Barra superior ── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            height: 66,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 clamp(16px,5vw,40px)',
            background: 'rgba(255,255,255,.86)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Image src="/brand/ventory-logo.png" alt="Ventory" width={130} height={34} priority />
          <div style={{ flex: 1 }} />
          <Link
            href="/login"
            style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', textDecoration: 'none', padding: '0 8px' }}
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="v-hover-primary"
            style={{ ...btnPrimario, height: 44, padding: '0 16px', fontSize: 14.5, boxShadow: '0 10px 22px -12px #6366F1cc' }}
          >
            Prueba gratis
          </Link>
        </header>

        {/* ── Portada ── */}
        <section
          style={{
            ...seccion,
            paddingTop: 'clamp(44px,7vw,80px)',
            background: 'radial-gradient(1100px 620px at 50% -10%, #EEF0FE 0%, var(--bg) 62%)',
          }}
        >
          <div style={{ ...contenedor, textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                background: '#EEF0FE',
                color: '#4338CA',
                fontWeight: 800,
                fontSize: 13,
                padding: '7px 16px',
                borderRadius: 99,
              }}
            >
              Prueba gratis 15 días · sin tarjeta de crédito
            </span>
            <h1
              style={{
                fontSize: 'clamp(32px,6.2vw,58px)',
                fontWeight: 800,
                letterSpacing: '-1.5px',
                lineHeight: 1.08,
                margin: '20px 0 0',
                textWrap: 'balance',
              }}
            >
              El punto de venta que{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                no te descuadra
              </span>{' '}
              el inventario
            </h1>
            <p
              style={{
                fontSize: 'clamp(16px,2.1vw,19px)',
                color: 'var(--muted)',
                lineHeight: 1.65,
                maxWidth: 620,
                margin: '18px auto 0',
              }}
            >
              Vende, controla tu stock y cuadra la caja desde el computador, la tablet o el celular.
              Sigue funcionando aunque se caiga el internet.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
              <Link href="/register" className="v-hover-primary" style={btnPrimario}>
                Empezar gratis
              </Link>
              <a href="#precio" className="v-hover-bg" style={btnSecundario}>
                Ver precio
              </a>
            </div>

            <div
              style={{
                marginTop: 'clamp(36px,6vw,60px)',
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: '0 40px 80px -40px rgba(16,20,30,.45)',
                background: 'var(--surface)',
                lineHeight: 0,
              }}
            >
              <Image
                src="/landing/pos.webp"
                alt="Pantalla de punto de venta de Ventory con el carrito y el total de la compra"
                width={2080}
                height={1300}
                priority
                sizes="(max-width: 1100px) 100vw, 1040px"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
              Pantallas reales del sistema, no ilustraciones.
            </div>
          </div>
        </section>

        {/* ── Beneficios ── */}
        <section style={{ ...seccion, background: 'var(--surface)' }}>
          <div style={contenedor}>
            <h2 style={h2Style}>Todo lo que un negocio necesita, sin complicaciones</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
                gap: 20,
                marginTop: 44,
              }}
            >
              {BENEFICIOS.map((b) => (
                <div
                  key={b.titulo}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '26px 24px',
                  }}
                >
                  <div style={{ fontSize: 26 }}>{b.icono}</div>
                  <div style={{ fontSize: 17.5, fontWeight: 800, margin: '12px 0 8px', letterSpacing: '-.3px' }}>
                    {b.titulo}
                  </div>
                  <div style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.7 }}>{b.texto}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── En cualquier dispositivo ── */}
        <section style={seccion}>
          <div
            style={{
              ...contenedor,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
              gap: 'clamp(28px,5vw,56px)',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ ...h2Style, textAlign: 'left' }}>En el mostrador o en la mano</h2>
              <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.75, marginTop: 16 }}>
                Ventory se adapta a la pantalla: en el computador aprovecha todo el espacio con el
                carrito al lado; en el celular deja el cobro siempre a la vista. Se instala como una
                aplicación y abre con un toque desde la pantalla de inicio.
              </p>
              <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Computador, tablet y celular',
                  'Se instala como aplicación',
                  'Escaneo con la cámara del celular',
                  'Impresión en térmica de tickets',
                ].map((li) => (
                  <li key={li} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
                    <span style={{ color: '#6366F1', fontWeight: 800 }}>✓</span> {li}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  borderRadius: 26,
                  overflow: 'hidden',
                  border: '8px solid #101828',
                  boxShadow: '0 40px 70px -30px rgba(16,20,30,.5)',
                  // ancho explícito: como ítem flex, sin él el marco colapsa a 0
                  width: '100%',
                  maxWidth: 290,
                  lineHeight: 0,
                }}
              >
                <Image
                  src="/landing/movil.webp"
                  alt="Ventory funcionando en la pantalla de un celular"
                  width={580}
                  height={1190}
                  sizes="290px"
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Reportes ── */}
        <section style={{ ...seccion, background: 'var(--surface)' }}>
          <div style={contenedor}>
            <h2 style={h2Style}>Toma decisiones con números, no con corazonadas</h2>
            <p
              style={{
                textAlign: 'center',
                fontSize: 16,
                color: 'var(--muted)',
                maxWidth: 640,
                margin: '16px auto 0',
                lineHeight: 1.7,
              }}
            >
              Cuánto vendiste, a qué hora, con qué método de pago, qué productos se mueven y —lo más
              importante— cuánta utilidad quedó después del costo y los gastos.
            </p>
            <div
              style={{
                marginTop: 40,
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: '0 30px 60px -35px rgba(16,20,30,.4)',
                lineHeight: 0,
              }}
            >
              <Image
                src="/landing/reportes.webp"
                alt="Pantalla de reportes con ventas por hora, métodos de pago y utilidad"
                width={2080}
                height={1300}
                sizes="(max-width: 1100px) 100vw, 1040px"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </section>

        {/* ── Cómo empezar ── */}
        <section style={seccion}>
          <div style={contenedor}>
            <h2 style={h2Style}>Empezar toma menos de lo que crees</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
                gap: 20,
                marginTop: 44,
              }}
            >
              {PASOS.map((p) => (
                <div key={p.n} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      margin: '0 auto',
                      borderRadius: '50%',
                      background: '#EEF0FE',
                      color: '#4338CA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 20,
                    }}
                  >
                    {p.n}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 17, marginTop: 14 }}>{p.t}</div>
                  <div style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>{p.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Precio ── */}
        <section id="precio" style={{ ...seccion, background: 'var(--surface)' }}>
          <div style={contenedor}>
            <h2 style={h2Style}>Un solo plan, todo incluido</h2>
            <p style={{ textAlign: 'center', fontSize: 16, color: 'var(--muted)', marginTop: 14 }}>
              Sin instalación, sin permanencia y sin funciones bloqueadas.
            </p>
            <div
              style={{
                maxWidth: 520,
                margin: '40px auto 0',
                background: 'var(--bg)',
                border: '2px solid #6366F1',
                borderRadius: 22,
                padding: 'clamp(26px,4vw,38px)',
                boxShadow: '0 30px 60px -35px rgba(99,102,241,.55)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#4338CA',
                    textTransform: 'uppercase',
                    letterSpacing: '.8px',
                  }}
                >
                  Plan Ventory
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 'clamp(36px,6vw,50px)', fontWeight: 800, letterSpacing: '-1.5px' }}>
                    {PRECIO_MENSUAL}
                  </span>
                  <span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}>/ mes</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
                  Primeros 15 días gratis · cancela cuando quieras
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                  gap: '8px 18px',
                  margin: '28px 0',
                }}
              >
                {INCLUYE.map((i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14.2, lineHeight: 1.5 }}>
                    <span style={{ color: '#6366F1', fontWeight: 800, flex: 'none' }}>✓</span>
                    <span>{i}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/register"
                className="v-hover-primary"
                style={{ ...btnPrimario, display: 'block', textAlign: 'center', lineHeight: '54px', padding: 0 }}
              >
                Empezar mi prueba gratis
              </Link>
            </div>
          </div>
        </section>

        {/* ── Cierre ── */}
        <section style={{ ...seccion, textAlign: 'center' }}>
          <div style={contenedor}>
            <h2 style={h2Style}>¿Listo para dejar el cuaderno?</h2>
            <p style={{ fontSize: 16, color: 'var(--muted)', maxWidth: 560, margin: '16px auto 26px', lineHeight: 1.7 }}>
              Crea tu cuenta y prueba Ventory con tus productos reales durante 15 días. Si tienes
              dudas, escríbenos: te ayudamos a montar tu inventario.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="v-hover-primary" style={btnPrimario}>
                Crear mi cuenta
              </Link>
              <a href="mailto:ventorypos@gmail.com" className="v-hover-bg" style={btnSecundario}>
                Escríbenos
              </a>
            </div>
          </div>
        </section>

        {/* ── Pie ── */}
        <footer style={{ borderTop: '1px solid var(--border)', padding: '34px clamp(20px,5vw,40px)' }}>
          <div
            style={{
              ...contenedor,
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 14,
              color: 'var(--muted)',
            }}
          >
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={116} height={30} />
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Link href="/ayuda" style={{ color: 'var(--muted)' }}>
                Centro de ayuda
              </Link>
              <Link href="/terminos" style={{ color: 'var(--muted)' }}>
                Términos
              </Link>
              <Link href="/privacidad" style={{ color: 'var(--muted)' }}>
                Tratamiento de datos
              </Link>
              <a href="mailto:ventorypos@gmail.com" style={{ color: 'var(--muted)' }}>
                ventorypos@gmail.com
              </a>
            </div>
            <div>© {new Date().getFullYear()} Ventory</div>
          </div>
        </footer>
      </div>
    </div>
  )
}
