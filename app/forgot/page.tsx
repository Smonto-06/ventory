'use client'

// Solicitar recuperación de contraseña — estilo del login del prototipo.

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import '../app/ventory.css'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'No se pudo enviar el correo. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vapp" data-theme="light">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1100px 620px at 50% -10%, #EEF0FE 0%, var(--bg) 60%)' }}>
        <div style={{ width: '100%', maxWidth: 420, animation: 'vfade .4s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
            <Image src="/brand/ventory-logo.png" alt="Ventory" width={280} height={71} priority style={{ objectFit: 'contain' }} />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 30, boxShadow: '0 1px 2px rgba(16,20,30,.04),0 22px 44px -28px rgba(16,20,30,.22)' }}>
            {sent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEF0FE', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 14px' }}>
                  ✉
                </div>
                <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>Revisa tu correo</h1>
                <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Si <b style={{ color: 'var(--text)' }}>{email}</b> está registrado, te enviamos un enlace
                  para restablecer tu contraseña. Vence en 1 hora — revisa también la carpeta de spam.
                </div>
                <Link href="/login" style={{ display: 'inline-block', marginTop: 20, color: '#6366F1', fontWeight: 700, fontSize: 14.5 }}>
                  ← Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <h1 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>¿Olvidaste tu contraseña?</h1>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
                  Escribe el correo con el que entras a Ventory y te enviaremos un enlace para crear una nueva.
                </div>
                {error && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FDECEC', border: '1px solid #F5C6C2', color: '#C9433B', borderRadius: 11, fontSize: 13.5, fontWeight: 600 }}>
                    {error}
                  </div>
                )}
                <form onSubmit={submit}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    autoComplete="email"
                    style={{ width: '100%', height: 46, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 15, marginBottom: 20 }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="v-hover-primary"
                    style={{ width: '100%', height: 48, borderRadius: 12, background: loading ? '#C7CDEC' : '#6366F1', color: '#fff', fontWeight: 700, fontSize: 15.5, cursor: loading ? 'wait' : 'pointer', boxShadow: '0 10px 22px -10px #6366F1cc' }}
                  >
                    {loading ? 'Enviando…' : 'Enviar enlace'}
                  </button>
                </form>
                <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
                  <Link href="/login" style={{ color: '#6366F1', fontWeight: 700 }}>
                    ← Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
