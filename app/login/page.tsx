'use client'

// Login — réplica 1:1 del prototipo (sección sLogin), con autenticación real
// (NextAuth). La sucursal y el rol vienen de la cuenta, no se eligen aquí.

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'


function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/app'

  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email,
        password: pass,
        redirect: false,
        callbackUrl,
      })
      if (result?.error) {
        setError('Email o contraseña incorrectos')
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    padding: '0 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 11,
    background: 'var(--input)',
    fontSize: 15,
  }

  return (
    <div className="vapp" data-theme="light">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1100px 620px at 50% -10%, #EEF0FE 0%, var(--bg) 60%)' }}>
        <div style={{ width: '100%', maxWidth: 420, animation: 'vfade .4s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
            <Image
              src="/brand/ventory-logo.png"
              alt="Ventory"
              width={330}
              height={84}
              priority
              style={{ objectFit: 'contain' }}
            />
            <div style={{ color: '#7A8091', fontSize: 14.5, marginTop: 8 }}>Sistema de Punto de Venta</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 30, boxShadow: '0 1px 2px rgba(16,20,30,.04),0 22px 44px -28px rgba(16,20,30,.22)' }}>
            <h1 style={{ margin: '0 0 22px', fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Iniciar sesión</h1>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FDECEC', border: '1px solid #F5C6C2', color: '#C9433B', borderRadius: 11, fontSize: 13.5, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                style={{ ...inputStyle, marginBottom: 18 }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Contraseña</label>
              <div style={{ position: 'relative', marginBottom: 24 }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  style={{ ...inputStyle, padding: '0 44px 0 14px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', cursor: 'pointer', padding: 4 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7" width="10" height="7" rx="2" fill="#9AA1AE" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="#9AA1AE" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="v-hover-primary"
                style={{ width: '100%', height: 48, borderRadius: 12, background: loading ? '#C7CDEC' : '#6366F1', color: '#fff', fontWeight: 700, fontSize: 15.5, cursor: loading ? 'wait' : 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc', transition: 'transform .1s' }}
              >
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>

            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <Link href="/forgot" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13.5 }}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
              ¿No tienes cuenta?{' '}
              <Link href="/register" style={{ color: '#6366F1', fontWeight: 700 }}>
                Registrar negocio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
