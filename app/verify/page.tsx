'use client'

// Verificación de correo — consume el token del enlace enviado al registrarse.

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'

function VerifyInner() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'verificando' | 'ok' | 'error'>('verificando')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('El enlace no tiene token. Abre el enlace completo del correo.')
      return
    }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null)
        if (r.ok) setState('ok')
        else {
          setState('error')
          setMessage(body?.error ?? 'No se pudo verificar el correo.')
        }
      })
      .catch(() => {
        setState('error')
        setMessage('Error de conexión. Intenta abrir el enlace de nuevo.')
      })
  }, [token])

  return (
    <div style={{ width: '100%', maxWidth: 420, animation: 'vfade .4s ease', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <Image src="/brand/ventory-logo.png" alt="Ventory" width={170} height={44} priority />
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '34px 28px', boxShadow: '0 24px 50px -30px rgba(16,20,30,.28)' }}>
        {state === 'verificando' && <div style={{ fontSize: 15, color: 'var(--muted)' }}>Verificando tu correo…</div>}
        {state === 'ok' && (
          <>
            <div style={{ width: 60, height: 60, margin: '0 auto', borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff', boxShadow: '0 10px 22px -8px #6366F199' }}>
              ✓
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 16 }}>¡Correo confirmado!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
              Tu cuenta quedó activa. Ya puedes iniciar sesión y empezar tu prueba gratis de 15 días.
            </div>
            <Link
              href="/login"
              style={{ display: 'block', marginTop: 22, height: 50, lineHeight: '50px', borderRadius: 13, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 10px 22px -10px #6366F1cc' }}
            >
              Iniciar sesión
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <div style={{ fontSize: 19, fontWeight: 800 }}>No se pudo verificar</div>
            <div style={{ fontSize: 14, color: '#C9433B', marginTop: 8, lineHeight: 1.6 }}>{message}</div>
            <Link href="/login" style={{ display: 'inline-block', marginTop: 18, color: '#6366F1', fontWeight: 700 }}>
              Ir a iniciar sesión →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="vapp" data-theme="light">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1100px 620px at 50% -10%, #EEF0FE 0%, var(--bg) 60%)' }}>
        <Suspense fallback={null}>
          <VerifyInner />
        </Suspense>
      </div>
    </div>
  )
}
