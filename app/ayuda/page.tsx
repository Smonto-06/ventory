import Link from 'next/link'
import { Icono, type NombreIcono } from '@/components/Icono'
import { Encabezado, Pie } from '@/components/publico/Cascaron'
import '../app/ventory.css'
import '../publico.css'

export const metadata = {
  title: 'Centro de ayuda — Ventory',
  description:
    'Guías y preguntas frecuentes sobre Ventory: primeros pasos, ventas y facturación, inventario, caja, cuenta y uso sin internet.',
}

const CORREO = 'ventorypos@gmail.com'

interface Tema {
  id: string
  titulo: string
  resumen: string
  icono: NombreIcono
  preguntas: Array<{ p: string; r: React.ReactNode }>
}

const TEMAS: Tema[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    resumen: 'Cómo dejar el sistema listo el primer día.',
    icono: 'rayo',
    preguntas: [
      {
        p: '¿Cómo empiezo a usar Ventory?',
        r: (
          <>
            Son tres pasos: <b>1)</b> crea tus productos (uno a uno desde Productos → Nuevo producto,
            o todos juntos con <b>Importar</b> desde un archivo de Excel); <b>2)</b> abre la caja con el
            efectivo con el que arrancas el día; <b>3)</b> entra a Punto de Venta y cobra tu primera
            venta. La guía de primeros pasos del panel principal te va marcando lo que falta.
          </>
        ),
      },
      {
        p: '¿Cómo subo todos mis productos de una vez?',
        r: (
          <>
            En <b>Productos → Importar</b> descarga la plantilla, llénala en Excel con tus productos
            (nombre, precio, costo, stock…) y guárdala como <b>CSV</b>. Al subirla verás una vista previa
            antes de confirmar, y el sistema te avisa si hay filas con errores o productos repetidos.
          </>
        ),
      },
      {
        p: 'Uso una pantalla táctil sin teclado, ¿cómo quito la barra del navegador?',
        r: (
          <>
            Con el botón de <b>pantalla completa</b>: está en la barra superior del punto de venta y
            también en el menú lateral. Como en un POS táctil no hay teclado para pulsar F11, ese botón
            hace lo mismo con un toque. Vuelve a tocarlo para salir.
          </>
        ),
      },
      {
        p: '¿Necesito instalar algo?',
        r: (
          <>
            No. Ventory funciona en el navegador. Si quieres que abra como una aplicación, entra desde
            Chrome y usa la opción <b>&quot;Instalar aplicación&quot;</b> o <b>&quot;Agregar a pantalla de
            inicio&quot;</b>; queda con su ícono y abre a pantalla completa.
          </>
        ),
      },
    ],
  },
  {
    id: 'ventas',
    titulo: 'Ventas y facturación',
    resumen: 'Cobro, métodos de pago, tickets e impresión.',
    icono: 'carrito',
    preguntas: [
      {
        p: '¿Cómo cobro con varios métodos de pago a la vez?',
        r: (
          <>
            En la pantalla de cobro puedes activar <b>Efectivo</b>, <b>Tarjeta</b> y <b>Transferencia</b> al
            tiempo: escribe el monto de cada uno y el resto se cobra en efectivo, con el cambio calculado.
            El <b>Crédito</b> (fiado) es exclusivo y requiere elegir un cliente.
          </>
        ),
      },
      {
        p: '¿Cómo vendo productos por peso (verduras, carnes, granel)?',
        r: (
          <>
            Al crear el producto elige <b>Se vende por: Peso (kg)</b> y pon el <b>precio por kilo</b>. Al
            venderlo se abre un teclado para digitar el peso (por ejemplo 0,750) y el sistema calcula el
            valor. El inventario también se descuenta en kilos.
          </>
        ),
      },
      {
        p: 'Vendo ropa o calzado, ¿cómo manejo tallas y colores?',
        r: (
          <>
            Al crear el producto marca <b>&quot;Tiene variantes&quot;</b> y define las opciones (por ejemplo
            Talla: S, M, L y Color: Azul, Negro). El sistema arma todas las combinaciones y cada una
            queda con <b>su propio inventario, precio, SKU y código de barras</b>. En el punto de venta
            aparece una sola tarjeta del producto: al tocarla eliges la talla y el color, y ves cuántas
            unidades quedan de cada una.
          </>
        ),
      },
      {
        p: 'Ya tenía un producto creado, ¿puedo agregarle variantes después?',
        r: (
          <>
            Sí. Entra a <b>Productos → Editar</b> en ese producto y agrega las combinaciones. El stock
            que ya tenía se traslada a la primera variante, para que no se pierda ni se duplique
            mercancía. De ahí en adelante el producto pasa a ser el agrupador y lo que se vende son sus
            variantes.
          </>
        ),
      },
      {
        p: '¿Puedo usar un lector de código de barras?',
        r: (
          <>
            Sí. Conecta cualquier lector USB y escanea: el producto entra solo al carrito. Desde el celular
            puedes usar el botón de <b>cámara</b> junto al buscador para escanear sin lector.
          </>
        ),
      },
      {
        p: '¿Cómo cambio los datos que salen en la factura?',
        r: (
          <>
            En <b>Ajustes → Facturación</b> puedes poner tu NIT, dirección, teléfono y el mensaje final del
            recibo. Lo que dejes vacío simplemente no se imprime.
          </>
        ),
      },
      {
        p: '¿Cómo conecto una impresora térmica?',
        r: (
          <>
            En <b>Ajustes → Impresora de tickets</b> elige <b>Conectar USB</b> o <b>Conectar Bluetooth</b> y
            selecciona tu impresora (58 o 80 mm). Usa el botón <b>Probar</b> para verificar. Sin impresora
            conectada, imprimir abre el diálogo normal del navegador.
          </>
        ),
      },
      {
        p: 'Me equivoqué en una venta, ¿qué hago?',
        r: (
          <>
            Si el cliente devuelve parte de la compra, usa <b>Devolución</b> desde el detalle de la venta:
            el stock regresa y se registra el reembolso. Si la venta completa fue un error, usa{' '}
            <b>Anular</b>: devuelve todo el stock y queda registrado quién la anuló y cuándo.
          </>
        ),
      },
    ],
  },
  {
    id: 'inventario',
    titulo: 'Inventario',
    resumen: 'Stock, kardex, ajustes y sucursales.',
    icono: 'caja',
    preguntas: [
      {
        p: '¿El inventario se actualiza solo?',
        r: (
          <>
            Sí, y no hay que sincronizar nada. Cada venta descuenta, cada compra suma, y las devoluciones
            y anulaciones regresan el stock <b>en el mismo momento</b> en que registras la operación.
          </>
        ),
      },
      {
        p: 'Conté la mercancía y no coincide con el sistema, ¿cómo lo corrijo?',
        r: (
          <>
            Usa <b>Productos → Ajuste de inventario</b>: escribe la cantidad real que contaste y el motivo.
            El ajuste queda registrado con tu nombre y la fecha, para que después puedas revisar de dónde
            vino cada diferencia.
          </>
        ),
      },
      {
        p: '¿Cómo sé de dónde salió una diferencia de stock?',
        r: (
          <>
            Cada producto tiene su <b>kardex</b>: la lista de todos sus movimientos con el stock antes y
            después, el motivo (venta F-000123, compra a un proveedor, devolución, ajuste) y el usuario que
            lo hizo. Además, en <b>Ajustes → Registro de actividad</b> ves todas las acciones del negocio.
          </>
        ),
      },
      {
        p: '¿Cómo manejo varias sucursales o bodegas?',
        r: (
          <>
            En <b>Ajustes → Sucursales</b> puedes crear las que necesites. Cada una tiene su propio
            inventario y sus propios turnos de caja, y cada equipo elige en cuál está trabajando.
          </>
        ),
      },
    ],
  },
  {
    id: 'caja',
    titulo: 'Caja y dinero',
    resumen: 'Apertura, cierre, diferencias y fiados.',
    icono: 'recibo',
    preguntas: [
      {
        p: '¿Qué significa el "saldo esperado" del cierre?',
        r: (
          <>
            Es el efectivo que debería haber en el cajón: <b>apertura + ventas en efectivo + ingresos −
            gastos</b>. Las ventas con tarjeta, transferencia o a crédito no entran ahí porque ese dinero
            no está en la caja — pero sí aparecen en el informe del turno.
          </>
        ),
      },
      {
        p: '¿Qué pasa si al cerrar hay diferencia?',
        r: (
          <>
            El sistema te la muestra (sobrante o faltante). Si la diferencia es grande, te pide una
            observación antes de cerrar, para que quede constancia de qué pasó.
          </>
        ),
      },
      {
        p: '¿Cómo termino el día y cierro sin abrir otro turno?',
        r: (
          <>
            En <b>Cerrar caja</b>, después de digitar el efectivo contado, elige{' '}
            <b>&quot;Cierre del día (sin abrir turno nuevo)&quot;</b>. Se imprime el informe del turno y puedes
            cerrar sesión.
          </>
        ),
      },
      {
        p: 'Un cliente me paga un fiado, ¿eso cuenta como venta?',
        r: (
          <>
            No. La venta se contó el día que se fió. Cuando el cliente abona, eso baja su saldo; si paga en
            efectivo entra a la caja como ingreso. Así no se cuenta la misma plata dos veces.
          </>
        ),
      },
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Cuenta y seguridad',
    resumen: 'Usuarios, permisos, contraseñas y respaldos.',
    icono: 'candado',
    preguntas: [
      {
        p: '¿Cómo creo usuarios para mis empleados?',
        r: (
          <>
            En <b>Ajustes → Gestión de usuarios</b>. El rol <b>Cajero</b> puede vender pero no ve reportes,
            costos ni auditoría, ni puede ajustar inventario. El rol <b>Administrador</b> tiene acceso
            completo.
          </>
        ),
      },
      {
        p: 'Olvidé mi contraseña',
        r: (
          <>
            En la pantalla de inicio de sesión usa <b>&quot;¿Olvidaste tu contraseña?&quot;</b> y te llega un
            enlace al correo para crear una nueva.
          </>
        ),
      },
      {
        p: '¿Mis datos están seguros y separados de otros negocios?',
        r: (
          <>
            Sí. Cada negocio tiene su información completamente aislada: productos, ventas, clientes e
            inventario son independientes y nadie fuera de tu negocio puede consultarlos. Las contraseñas
            se guardan cifradas.
          </>
        ),
      },
      {
        p: '¿Puedo sacar una copia de mi información?',
        r: (
          <>
            Cuando quieras. En <b>Ajustes → Exportar datos</b> descargas tus ventas, inventario, clientes y
            compras en Excel, o un <b>respaldo completo</b> del negocio en un solo archivo.
          </>
        ),
      },
    ],
  },
  {
    id: 'sin-internet',
    titulo: 'Sin internet',
    resumen: 'Qué sigue funcionando cuando se cae la red.',
    icono: 'senal',
    preguntas: [
      {
        p: '¿Qué pasa si se cae el internet?',
        r: (
          <>
            Puedes seguir vendiendo. Aparece un aviso de &quot;Sin conexión&quot; y las ventas se guardan en el
            equipo. Cuando vuelve la señal se envían solas y el inventario se descuenta en ese momento.
          </>
        ),
      },
      {
        p: '¿Qué NO puedo hacer sin internet?',
        r: (
          <>
            Abrir o cerrar caja, ventas a crédito, compras, reportes y crear productos necesitan conexión.
            Nuestra recomendación: <b>sincroniza antes de cerrar el día</b> para que el cierre cuadre con
            todas las ventas.
          </>
        ),
      },
    ],
  },
]

const TOTAL_PREGUNTAS = TEMAS.reduce((n, t) => n + t.preguntas.length, 0)

const contenedor: React.CSSProperties = { maxWidth: 1140, margin: '0 auto', width: '100%' }

export default function AyudaPage() {
  return (
    <div className="vapp v-pub" data-theme="light">
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>
        <Encabezado />

        {/* ══ Portada del centro de ayuda ══ */}
        <section
          className="v-pub-reticula"
          style={{
            padding: 'clamp(40px,6vw,72px) clamp(18px,5vw,36px) clamp(34px,5vw,54px)',
            borderBottom: '1px solid var(--border)',
            background:
              'radial-gradient(900px 420px at 22% -140px, rgba(99,102,241,.14) 0%, rgba(246,248,251,0) 72%)',
          }}
        >
          <div style={contenedor}>
            <nav
              aria-label="Ruta de navegación"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.4, color: 'var(--muted)' }}
            >
              <Link href="/" className="v-pub-nav">
                Inicio
              </Link>
              <span aria-hidden="true">/</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>Centro de ayuda</span>
            </nav>

            <h1
              style={{
                margin: '18px 0 0',
                fontSize: 'clamp(30px,4.6vw,46px)',
                fontWeight: 700,
                letterSpacing: '-1.5px',
                lineHeight: 1.1,
              }}
            >
              Centro de ayuda
            </h1>
            <p
              style={{
                fontSize: 17,
                color: 'var(--muted)',
                lineHeight: 1.72,
                margin: '16px 0 0',
                maxWidth: 660,
              }}
            >
              {TOTAL_PREGUNTAS} respuestas cortas a lo que más se pregunta, organizadas por tema. Si no
              encuentras lo que buscas, escríbenos y te respondemos.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
              <a
                href={`mailto:${CORREO}`}
                className="v-pub-btn-primario"
                style={{
                  height: 48,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '0 22px',
                  borderRadius: 12,
                  background: 'var(--acento)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                  boxShadow: '0 14px 30px -18px rgba(79,70,229,.95)',
                }}
              >
                <Icono n="correo" tam={17} />
                Escríbenos
              </a>
              <Link
                href="/login"
                className="v-pub-btn-borde"
                style={{
                  height: 48,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '0 20px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                Entrar al sistema
                <Icono n="flecha" tam={17} />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ Índice + contenido ══ */}
        <div style={{ padding: 'clamp(32px,5vw,56px) clamp(18px,5vw,36px) clamp(56px,7vw,84px)' }}>
          <div
            className="v-pub-columnas"
            style={{
              ...contenedor,
              display: 'grid',
              gridTemplateColumns: 'minmax(230px,268px) minmax(0,1fr)',
              gap: 'clamp(28px,4vw,52px)',
              alignItems: 'start',
            }}
          >
            {/* Índice fijo (se oculta en pantallas angostas) */}
            <aside className="v-pub-lateral" style={{ position: 'sticky', top: 92 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  padding: '0 12px 12px',
                }}
              >
                Temas
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {TEMAS.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="v-pub-indice"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '11px 12px',
                      borderRadius: 11,
                      color: 'var(--text)',
                      fontSize: 14.4,
                      fontWeight: 600,
                    }}
                  >
                    <Icono n={t.icono} tam={18} />
                    <span style={{ flex: 1 }}>{t.titulo}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
                      {t.preguntas.length}
                    </span>
                  </a>
                ))}
              </nav>

              <div
                style={{
                  marginTop: 22,
                  padding: 18,
                  borderRadius: 14,
                  background: 'var(--acento-suave)',
                  border: '1px solid var(--acento-borde)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--acento-fuerte)' }}>
                  <Icono n="ayuda" tam={18} />
                  <span style={{ fontSize: 14.2, fontWeight: 700 }}>¿No lo encuentras?</span>
                </div>
                <p style={{ fontSize: 13.4, color: 'var(--acento-fuerte)', lineHeight: 1.65, margin: '9px 0 0' }}>
                  Escríbenos a{' '}
                  <a href={`mailto:${CORREO}`} style={{ color: 'var(--acento)', fontWeight: 700, textDecoration: 'none' }}>
                    {CORREO}
                  </a>{' '}
                  y te respondemos.
                </p>
              </div>
            </aside>

            {/* Temas */}
            <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(30px,4vw,44px)' }}>
              {TEMAS.map((t) => (
                <section key={t.id} id={t.id} style={{ scrollMarginTop: 88 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: 'var(--acento-suave)',
                        color: 'var(--acento)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Icono n={t.icono} tam={21} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontSize: 21.5, fontWeight: 700, letterSpacing: '-.5px', margin: 0 }}>
                        {t.titulo}
                      </h2>
                      <p style={{ fontSize: 14.4, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.6 }}>
                        {t.resumen}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      background: 'var(--surface)',
                      overflow: 'hidden',
                    }}
                  >
                    {t.preguntas.map((q, i) => (
                      <details
                        key={q.p}
                        className="v-pub-faq"
                        style={{
                          padding: 'clamp(17px,2.2vw,21px) clamp(18px,2.4vw,24px)',
                          borderTop: i === 0 ? 'none' : '1px solid var(--linea)',
                        }}
                      >
                        <summary
                          style={{
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 15.4,
                            letterSpacing: '-.2px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 14,
                            transition: 'color .14s ease',
                          }}
                        >
                          {q.p}
                          <span className="v-pub-chevron" style={{ color: 'var(--acento)' }}>
                            <Icono n="chevron" tam={18} />
                          </span>
                        </summary>
                        <div style={{ fontSize: 14.8, color: 'var(--muted)', lineHeight: 1.78, marginTop: 13 }}>
                          {q.r}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}

              {/* Contacto */}
              <div
                style={{
                  border: '1px solid var(--acento-borde)',
                  background: 'var(--acento-suave)',
                  borderRadius: 18,
                  padding: 'clamp(24px,3.4vw,34px)',
                  display: 'flex',
                  gap: 20,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ minWidth: 240, flex: 1 }}>
                  <div style={{ fontSize: 18.5, fontWeight: 700, color: 'var(--acento-fuerte)', letterSpacing: '-.4px' }}>
                    ¿Necesitas ayuda con algo más?
                  </div>
                  <p style={{ fontSize: 14.6, color: 'var(--acento-fuerte)', lineHeight: 1.72, margin: '9px 0 0' }}>
                    Escríbenos y te respondemos. Si ya eres cliente, también puedes usar el botón{' '}
                    <b>Contáctanos</b> dentro del sistema — así sabemos de qué negocio nos escribes.
                  </p>
                </div>
                <a
                  href={`mailto:${CORREO}`}
                  className="v-pub-btn-primario"
                  style={{
                    height: 50,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '0 24px',
                    borderRadius: 13,
                    background: 'var(--acento)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 15,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 14px 30px -18px rgba(79,70,229,.95)',
                  }}
                >
                  <Icono n="correo" tam={17} />
                  {CORREO}
                </a>
              </div>
            </main>
          </div>
        </div>

        <Pie />
      </div>
    </div>
  )
}
