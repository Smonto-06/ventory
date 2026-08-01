'use client'

// Escáner con cámara — usa la API BarcodeDetector (Chrome/Edge, Android).
// Detecta el código, agrega el producto al carrito y sigue escaneando
// hasta que se cierre. Si el navegador no soporta la API o no hay cámara,
// muestra el mensaje correspondiente (el lector USB y la búsqueda siguen
// funcionando siempre).

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { Icono } from '@/components/Icono'

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}

export default function ScannerModal() {
  const s = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'iniciando' | 'listo' | 'sin-soporte' | 'sin-camara'>('iniciando')
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 })

  // Referencias estables para no reiniciar la cámara en cada render del store
  const productsRef = useRef(s.products)
  productsRef.current = s.products
  const addRef = useRef(s.addToCart)
  addRef.current = s.addToCart
  const toastRef = useRef(s.toast)
  toastRef.current = s.toast

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const start = async () => {
      const BD = (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike })
        .BarcodeDetector
      if (!BD) {
        setStatus('sin-soporte')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
      } catch {
        setStatus('sin-camara')
        return
      }
      if (cancelled || !videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
      setStatus('listo')

      const detector = new BD({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      })
      timer = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const codes = await detector.detect(videoRef.current)
          const code = codes[0]?.rawValue?.trim()
          if (!code) return
          // Anti-rebote: el mismo código no se repite en 2,5 s
          const now = Date.now()
          if (lastCode.current.code === code && now - lastCode.current.at < 2500) return
          lastCode.current = { code, at: now }
          const p = productsRef.current.find((x) => x.barcode === code)
          if (p) {
            addRef.current(p)
            toastRef.current(`${p.name} agregado`)
            if (navigator.vibrate) navigator.vibrate(80)
          } else {
            toastRef.current(`Código ${code} sin producto`)
          }
        } catch {
          // detect puede fallar en frames sueltos; se ignora
        }
      }, 350)
    }
    start()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div
      data-no-print="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.6)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={s.closeModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px -30px rgba(15,25,23,.6)', animation: 'vpop .25s ease' }}
      >
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: '#6366F1' }}>
            <Icono n="codigo" tam={20} />
          </span>
          Escanear código
        </h2>

        {status === 'sin-soporte' && (
          <div style={{ marginTop: 14, background: '#FDF4E5', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#8A6B2E', lineHeight: 1.6 }}>
            Este navegador no soporta escaneo con cámara. Funciona en <b>Chrome o Edge</b> (celular
            Android o computador). También puedes usar un lector USB: escanea y el producto se
            agrega solo.
          </div>
        )}
        {status === 'sin-camara' && (
          <div style={{ marginTop: 14, background: '#FDECEC', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#C9433B', lineHeight: 1.6 }}>
            No se pudo acceder a la cámara. Revisa que el navegador tenga permiso de cámara para
            este sitio.
          </div>
        )}
        {(status === 'iniciando' || status === 'listo') && (
          <>
            <div style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden', background: '#0F172A', position: 'relative', aspectRatio: '4 / 3' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {status === 'iniciando' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7EA6A0', fontSize: 14, fontWeight: 600 }}>
                  Iniciando cámara…
                </div>
              )}
              {status === 'listo' && (
                <div style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: '24%', border: '2px solid #A5B4FC', borderRadius: 10, boxShadow: '0 0 0 2000px rgba(15,23,42,.25)' }} />
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              Apunta al código de barras — el producto se agrega solo y puedes seguir escaneando.
            </div>
          </>
        )}

        <button
          onClick={s.closeModal}
          style={{ width: '100%', height: 48, marginTop: 16, borderRadius: 12, background: '#6366F1', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc' }}
        >
          Listo
        </button>
      </div>
    </div>
  )
}
