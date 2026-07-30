import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'

export const metadata = { title: 'Términos de servicio — Ventory' }

const H: React.CSSProperties = { fontSize: 17, fontWeight: 800, margin: '26px 0 8px' }
const P: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.75, color: '#3A4150', margin: '0 0 10px' }

export default function TerminosPage() {
  return (
    <div className="vapp" data-theme="light">
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={140} height={36} />
          </Link>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(24px,4vw,40px)' }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Términos de servicio</h1>
            <p style={{ ...P, marginTop: 8, color: 'var(--muted)' }}>Última actualización: julio de 2026</p>

            <div style={H}>1. El servicio</div>
            <p style={P}>
              Ventory es un sistema de punto de venta e inventario en línea para pequeños y medianos
              negocios. Al crear una cuenta aceptas estos términos en nombre del negocio que registras.
            </p>

            <div style={H}>2. Prueba gratis y plan</div>
            <p style={P}>
              Las cuentas nuevas incluyen una prueba gratis de 15 días con todas las funciones. Al
              finalizar la prueba, el uso del sistema requiere un plan activo. Si el plan no se activa
              o se suspende por falta de pago, el acceso a registrar operaciones se bloquea, pero tus
              datos se conservan y puedes exportarlos o reactivar el plan en cualquier momento.
            </p>

            <div style={H}>3. Tu información</div>
            <p style={P}>
              Los datos que registras (productos, ventas, clientes, proveedores, caja) son tuyos.
              Puedes exportarlos en cualquier momento desde Ajustes (CSV y respaldo completo). El
              tratamiento de datos personales se rige por nuestra{' '}
              <Link href="/privacidad" style={{ color: '#6366F1', fontWeight: 700 }}>
                Política de tratamiento de datos
              </Link>
              .
            </p>

            <div style={H}>4. Responsabilidades del negocio</div>
            <p style={P}>
              Eres responsable de la exactitud de la información que registras, de custodiar tus
              credenciales de acceso, de gestionar los permisos de tus usuarios (cajeros,
              supervisores) y del cumplimiento de tus obligaciones tributarias y comerciales. Ventory
              es una herramienta de registro y control; no sustituye la facturación electrónica DIAN
              ni la asesoría contable.
            </p>

            <div style={H}>5. Disponibilidad</div>
            <p style={P}>
              Trabajamos para que el servicio esté disponible de forma continua, pero puede haber
              interrupciones por mantenimiento o causas ajenas. Te recomendamos descargar respaldos
              periódicos desde Ajustes.
            </p>

            <div style={H}>6. Uso aceptable</div>
            <p style={P}>
              No está permitido usar el sistema para actividades ilegales, intentar acceder a datos de
              otros negocios o revender el servicio sin autorización. El incumplimiento puede terminar
              la cuenta.
            </p>

            <div style={H}>7. Contacto</div>
            <p style={P}>
              Escríbenos a <b>ventorypos@gmail.com</b> o desde el botón &quot;Contáctanos&quot; dentro del
              sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
