import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isSuperAdmin, superAdminConfigured } from '@/lib/plan'
import AdminClient from './AdminClient'
import '../app/ventory.css'

export const dynamic = 'force-dynamic'

// Panel del super-admin: solo accesible para SUPER_ADMIN_EMAIL.
// Si el acceso falla, se muestra un diagnóstico en vez de redirigir en
// silencio, para que el dueño pueda ver qué parte de la configuración falta.
export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  if (!isSuperAdmin(session.user.email)) {
    const configured = superAdminConfigured()
    return (
      <div className="vapp" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 50px -30px rgba(16,20,30,.28)' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Panel de plataforma</div>
          <div style={{ marginTop: 6, fontSize: 14, color: 'var(--muted)' }}>
            Esta cuenta no tiene acceso de super administrador.
          </div>

          <div style={{ marginTop: 18, background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <span style={{ color: 'var(--muted)' }}>Sesión iniciada como:</span>{' '}
              <b>{session.user.email}</b>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>Variable SUPER_ADMIN_EMAIL en este despliegue:</span>{' '}
              {configured ? (
                <b style={{ color: '#B4740A' }}>configurada, pero no coincide con tu correo</b>
              ) : (
                <b style={{ color: '#C9433B' }}>no configurada</b>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {configured ? (
              <>
                El valor de <b>SUPER_ADMIN_EMAIL</b> en Vercel no es igual al correo de esta
                sesión. Corrige el valor (o inicia sesión con el correo configurado) y
                recuerda hacer <b>Redeploy</b> después de cambiarlo.
              </>
            ) : (
              <>
                Este despliegue no tiene la variable <b>SUPER_ADMIN_EMAIL</b>. Agrégala en
                Vercel (Settings → Environment Variables, ambiente Production) y haz{' '}
                <b>Redeploy</b> — las variables solo aplican en el siguiente despliegue.
              </>
            )}
          </div>

          <a
            href="/app"
            style={{ display: 'block', textAlign: 'center', marginTop: 22, height: 48, lineHeight: '48px', borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14.5, textDecoration: 'none', boxShadow: '0 8px 18px -8px #6366F1cc' }}
          >
            Volver al sistema
          </a>
        </div>
      </div>
    )
  }

  return <AdminClient />
}
