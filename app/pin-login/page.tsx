'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PinLoginPage() {
  const router = useRouter()
  const [businessSlug, setBusinessSlug] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [step, setStep] = useState<'business' | 'pin'>('business')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    if (step === 'pin') {
      pinRefs[0].current?.focus()
    }
  }, [step])

  function handlePinChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus()
    }
  }

  function handlePinKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus()
    }
  }

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (businessSlug.trim()) setStep('pin')
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pinCode = pin.join('')
    if (pinCode.length !== 4) {
      setError('Ingresa los 4 dígitos del PIN')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessSlug: businessSlug.trim(), pin: pinCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'PIN incorrecto')
        setPin(['', '', '', ''])
        pinRefs[0].current?.focus()
        return
      }

      router.push('/dashboard')
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
                  onClick={() => { setStep('business'); setError(''); setPin(['', '', '', '']) }}
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

              <form onSubmit={handlePinSubmit} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {pin.map((digit, i) => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || pin.join('').length !== 4}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verificando...' : 'Entrar'}
                </button>
              </form>
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
