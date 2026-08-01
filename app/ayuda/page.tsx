import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'

export const metadata = {
  title: 'Centro de ayuda — Ventory',
  description: 'Guías rápidas y preguntas frecuentes sobre Ventory: ventas, inventario, caja, clientes y facturación.',
}

interface Tema {
  titulo: string
  icono: string
  preguntas: Array<{ p: string; r: React.ReactNode }>
}

const TEMAS: Tema[] = [
  {
    titulo: 'Primeros pasos',
    icono: '🚀',
    preguntas: [
      {
        p: '¿Cómo empiezo a usar Ventory?',
        r: (
          <>
            Son tres pasos: <b>1)</b> crea tus productos (uno a uno desde Productos → Nuevo producto,
            o todos juntos con <b>Importar</b> desde un archivo de Excel); <b>2)</b> abre la caja con el
            efectivo con el que arrancas el día; <b>3)</b> entra a Punto de Venta y cobra tu primera
            venta. El sistema te va guiando desde el panel principal.
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
    titulo: 'Ventas y facturación',
    icono: '🛒',
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
        p: '¿Puedo usar un lector de código de barras?',
        r: (
          <>
            Sí. Conecta cualquier lector USB y escanea: el producto entra solo al carrito. Desde el celular
            puedes usar el botón <b>📷</b> junto al buscador para escanear con la cámara.
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
    titulo: 'Inventario',
    icono: '📦',
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
    titulo: 'Caja y dinero',
    icono: '🧾',
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
    titulo: 'Cuenta y seguridad',
    icono: '🔒',
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
    titulo: 'Sin internet',
    icono: '📶',
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

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 'clamp(20px,3vw,28px)',
}

export default function AyudaPage() {
  return (
    <div className="vapp" data-theme="light">
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        {/* Encabezado */}
        <header
          style={{
            height: 66,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 clamp(16px,5vw,40px)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <Link href="/">
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={130} height={34} />
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/login" style={{ fontWeight: 700, fontSize: 14.5, color: '#6366F1', textDecoration: 'none' }}>
            Entrar al sistema →
          </Link>
        </header>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(30px,5vw,56px) clamp(20px,5vw,32px) 70px' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-1px' }}>
            Centro de ayuda
          </h1>
          <p style={{ fontSize: 16.5, color: 'var(--muted)', lineHeight: 1.7, marginTop: 12 }}>
            Respuestas cortas a las preguntas más comunes. Si no encuentras lo que buscas, escríbenos a{' '}
            <a href="mailto:ventorypos@gmail.com" style={{ color: '#6366F1', fontWeight: 700 }}>
              ventorypos@gmail.com
            </a>{' '}
            y te respondemos.
          </p>

          {/* Índice */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '26px 0 8px' }}>
            {TEMAS.map((t) => (
              <a
                key={t.titulo}
                href={`#${t.titulo.replace(/\s+/g, '-').toLowerCase()}`}
                className="v-hover-bg"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  height: 40,
                  padding: '0 14px',
                  borderRadius: 11,
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 13.5,
                  textDecoration: 'none',
                }}
              >
                <span>{t.icono}</span> {t.titulo}
              </a>
            ))}
          </div>

          {/* Temas */}
          {TEMAS.map((t) => (
            <section key={t.titulo} id={t.titulo.replace(/\s+/g, '-').toLowerCase()} style={{ marginTop: 38, scrollMarginTop: 80 }}>
              <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px', margin: '0 0 16px' }}>
                {t.icono} {t.titulo}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {t.preguntas.map((q) => (
                  <details key={q.p} style={card}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 15.5,
                        listStyle: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      {q.p}
                      <span style={{ color: '#6366F1', fontWeight: 800, flex: 'none' }}>+</span>
                    </summary>
                    <div style={{ fontSize: 14.8, color: 'var(--muted)', lineHeight: 1.75, marginTop: 12 }}>{q.r}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          {/* Contacto */}
          <div
            style={{
              ...card,
              marginTop: 44,
              textAlign: 'center',
              background: '#EEF0FE',
              border: '1px solid #C7D0FB',
            }}
          >
            <div style={{ fontSize: 19, fontWeight: 800, color: '#312E81' }}>¿Necesitas ayuda con algo más?</div>
            <p style={{ fontSize: 15, color: '#4338CA', lineHeight: 1.7, margin: '10px 0 18px' }}>
              Escríbenos y te respondemos. Si eres cliente, también puedes usar el botón{' '}
              <b>Contáctanos</b> dentro del sistema — así sabemos de qué negocio nos escribes.
            </p>
            <a
              href="mailto:ventorypos@gmail.com"
              className="v-hover-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 50,
                padding: '0 26px',
                borderRadius: 13,
                background: '#6366F1',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 12px 26px -14px #6366F1',
              }}
            >
              ventorypos@gmail.com
            </a>
          </div>

          <div style={{ marginTop: 34, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>← Inicio</Link>
            <Link href="/terminos" style={{ color: 'var(--muted)' }}>Términos de servicio</Link>
            <Link href="/privacidad" style={{ color: 'var(--muted)' }}>Tratamiento de datos</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
