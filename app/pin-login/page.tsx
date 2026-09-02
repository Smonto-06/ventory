'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TECLAS_PIN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar']

export default function PinLoginPage() {
  const router = useRouter()
  const [businessSlug, setBusinessSlug] = useState('')
  const [pin, setPin] = useState('')
  const [step, setStep] = useState<'business' | 'pin'>('business')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function pressTecla(k: string) {
    if (k === 'borrar') {
      setPin((p) => p.slice(0, -1))
    } else if (k && pin.length < 4) {
      setPin((p) => (p + k).slice(0, 4))
    }
  }

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (businessSlug.trim()) setStep('pin')
  }

  async function handlePinSubmit() {
    if (pin.length !== 4) {
      setError('Ingresa los 4 dígitos del PIN')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessSlug: businessSlug.trim(), pin }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'PIN incorrecto')
        setPin('')
        return
      }

      router.push('/app')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ventory</h1>
          <p className="text-gray-500 mt-1">Acceso rápido de cajero</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {step === 'business' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">¿En qué negocio trabajas?</h2>
              <p className="text-sm text-gray-500 mb-6">Ingresa el identificador de tu negocio</p>

              <form onSubmit={handleBusinessSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  value={businessSlug}
                  onChange={(e) => setBusinessSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                  placeholder="mi-negocio"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continuar
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => { setStep('business'); setError(''); setPin('') }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Ingresa tu PIN</h2>
                  <p className="text-sm text-gray-500">{businessSlug}</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-14 h-14 flex items-center justify-center text-2xl font-bold border-2 border-gray-300 rounded-xl"
                    >
                      {pin[i] ? '•' : ''}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {TECLAS_PIN.map((k, i) =>
                    k ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pressTecla(k)}
                        className={
                          k === 'borrar'
                            ? 'h-14 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-colors'
                            : 'h-14 rounded-xl bg-gray-50 text-gray-900 font-bold text-xl hover:bg-gray-100 transition-colors'
                        }
                      >
                        {k === 'borrar' ? 'Borrar' : k}
                      </button>
                    ) : (
                      <div key={i} />
                    ),
                  )}
                </div>

                <button
                  type="button"
                  onClick={handlePinSubmit}
                  disabled={loading || pin.length !== 4}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verificando...' : 'Entrar'}
                </button>
              </div>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100">
            <Link
              href="/login"
              className="block text-center text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              Acceso de administrador →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
