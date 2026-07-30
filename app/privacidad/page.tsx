import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'

export const metadata = { title: 'Política de tratamiento de datos — Ventory' }

const H: React.CSSProperties = { fontSize: 17, fontWeight: 800, margin: '26px 0 8px' }
const P: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.75, color: '#3A4150', margin: '0 0 10px' }

export default function PrivacidadPage() {
  return (
    <div className="vapp" data-theme="light">
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={140} height={36} />
          </Link>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(24px,4vw,40px)' }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>
              Política de tratamiento de datos personales
            </h1>
            <p style={{ ...P, marginTop: 8, color: 'var(--muted)' }}>
              Conforme a la Ley 1581 de 2012 (Habeas Data) y sus decretos reglamentarios · Última
              actualización: julio de 2026
            </p>

            <div style={H}>1. Responsable del tratamiento</div>
            <p style={P}>
              Ventory POS · correo de contacto: <b>ventorypos@gmail.com</b>. Este canal atiende
              consultas, reclamos y solicitudes relacionadas con datos personales.
            </p>

            <div style={H}>2. Datos que tratamos</div>
            <p style={P}>
              <b>De los negocios que se registran:</b> nombre del negocio, NIT, dirección, teléfono,
              correo y nombre de los usuarios que el negocio crea (administradores, cajeros).
              <br />
              <b>De los clientes finales de cada negocio:</b> los datos que el negocio registre para su
              operación (nombre, teléfono, documento, saldo de crédito). De estos datos, cada negocio
              es responsable del tratamiento y Ventory actúa como encargado: los almacena por cuenta
              del negocio y no los usa para fines propios.
            </p>

            <div style={H}>3. Finalidades</div>
            <p style={P}>
              Prestar el servicio (autenticación, registro de operaciones, reportes y respaldos),
              comunicarnos contigo sobre tu cuenta (verificación de correo, recuperación de
              contraseña, avisos del plan) y mejorar el sistema. No vendemos datos personales ni los
              compartimos con terceros para publicidad.
            </p>

            <div style={H}>4. Derechos del titular</div>
            <p style={P}>
              Conocer, actualizar, rectificar y suprimir tus datos; solicitar prueba de la
              autorización; ser informado sobre el uso; presentar quejas ante la Superintendencia de
              Industria y Comercio; y revocar la autorización. Para ejercerlos, escribe a{' '}
              <b>ventorypos@gmail.com</b> — respondemos dentro de los términos de ley (10 días hábiles
              para consultas, 15 para reclamos).
            </p>

            <div style={H}>5. Seguridad y conservación</div>
            <p style={P}>
              Los datos se almacenan cifrados en tránsito (HTTPS) y en reposo en proveedores de
              infraestructura en la nube. Las contraseñas se guardan con hash irreversible. Los datos
              se conservan mientras la cuenta exista; al eliminarse una cuenta, su información se
              borra de forma definitiva.
            </p>

            <div style={H}>6. Exportación y supresión</div>
            <p style={P}>
              Cada negocio puede exportar toda su información desde Ajustes (CSV y respaldo completo)
              y solicitar la eliminación definitiva de su cuenta y sus datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
