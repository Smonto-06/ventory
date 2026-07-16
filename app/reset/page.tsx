'use client'

// Restablecer contraseña con token — estilo del login del prototipo.

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'

function ResetContent() {
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    if (password !== confirm) return setError('Las contraseñas no coinciden')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => router.push('/login'), 2500)
      } else {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'No se pudo restablecer. Solicita un enlace nuevo.')
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
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={280} height={71} priority style={{ objectFit: 'contain' }} />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 30, boxShadow: '0 1px 2px rgba(16,20,30,.04),0 22px 44px -28px rgba(16,20,30,.22)' }}>
            {done ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#6366F1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 14px', boxShadow: '0 10px 22px -8px #6366F199' }}>
                  ✓
                </div>
                <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>Contraseña actualizada</h1>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>Te llevamos al inicio de sesión…</div>
              </div>
            ) : !token ? (
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>Enlace inválido</h1>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>Este enlace está incompleto o venció.</div>
                <Link href="/forgot" style={{ display: 'inline-block', marginTop: 20, color: '#6366F1', fontWeight: 700, fontSize: 14.5 }}>
                  Solicitar uno nuevo →
                </Link>
              </div>
            ) : (
              <>
                <h1 style={{ margin: '0 0 20px', fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Nueva contraseña</h1>
                {error && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FDECEC', border: '1px solid #F5C6C2', color: '#C9433B', borderRadius: 11, fontSize: 13.5, fontWeight: 600 }}>
                    {error}
                  </div>
                )}
                <form onSubmit={submit}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Contraseña nueva</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    style={{ ...inputStyle, marginBottom: 16 }}
                  />
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Repite la contraseña</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                    style={{ ...inputStyle, marginBottom: 20 }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="v-hover-primary"
                    style={{ width: '100%', height: 48, borderRadius: 12, background: loading ? '#C7CDEC' : '#6366F1', color: '#fff', fontWeight: 700, fontSize: 15.5, cursor: loading ? 'wait' : 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc' }}
                  >
                    {loading ? 'Guardando…' : 'Guardar contraseña'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetContent />
    </Suspense>
  )
}
