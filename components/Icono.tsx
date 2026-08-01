// Set de iconos de línea compartido por el sistema y las páginas públicas.
// Un solo trazo, mismo grosor y mismas terminaciones, para que todo se vea
// de la misma familia. Reemplaza a los emojis.

import type { ReactNode } from 'react'

export type NombreIcono =
  | 'carrito'
  | 'caja'
  | 'recibo'
  | 'senal'
  | 'billetera'
  | 'tendencia'
  | 'check'
  | 'flecha'
  | 'monitor'
  | 'celular'
  | 'impresora'
  | 'codigo'
  | 'candado'
  | 'usuarios'
  | 'sucursal'
  | 'escudo'
  | 'reloj'
  | 'correo'
  | 'chevron'
  | 'ayuda'
  | 'descarga'
  | 'rayo'
  | 'documento'
  | 'lupa'
  | 'dinero'
  | 'balanza'
  | 'subida'
  | 'lapiz'
  | 'alerta'

const TRAZOS: Record<NombreIcono, ReactNode> = {
  carrito: (
    <>
      <circle cx="9.2" cy="19.8" r="1.35" />
      <circle cx="17.6" cy="19.8" r="1.35" />
      <path d="M2.6 3.4h2.3l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L20.6 7.2H6" />
    </>
  ),
  caja: (
    <>
      <path d="M12 2.9 20.4 7v10L12 21.1 3.6 17V7L12 2.9Z" />
      <path d="M3.6 7 12 11.5 20.4 7" />
      <path d="M12 11.5v9.6" />
    </>
  ),
  recibo: (
    <>
      <path d="M6.2 2.9h11.6v18.2l-2.3-1.5-2.3 1.5-2.4-1.5-2.3 1.5-2.3-1.5V2.9Z" />
      <path d="M9.2 8.2h5.6M9.2 12.2h5.6" />
    </>
  ),
  senal: (
    <>
      <path d="M2.9 8.7a13.6 13.6 0 0 1 18.2 0" />
      <path d="M6.3 12.3a8.8 8.8 0 0 1 11.4 0" />
      <path d="M9.7 15.8a4 4 0 0 1 4.6 0" />
      <circle cx="12" cy="19.3" r="1" />
    </>
  ),
  billetera: (
    <>
      <path d="M3.2 7.6A2.5 2.5 0 0 1 5.7 5.1h12.1a1.9 1.9 0 0 1 1.9 1.9v1.6" />
      <path d="M3.2 7.6v8.9a2.5 2.5 0 0 0 2.5 2.5h13.2a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H5.7" />
      <circle cx="16.6" cy="14" r="1.05" />
    </>
  ),
  tendencia: (
    <>
      <path d="m3.2 16.8 5.8-6.2 3.9 3.9 7.9-7.9" />
      <path d="M14.9 6.6h5.9v5.9" />
    </>
  ),
  check: <path d="m4.8 12.6 4.9 4.9L19.2 6.6" />,
  flecha: (
    <>
      <path d="M4 12h14.6" />
      <path d="m12.8 6.2 5.8 5.8-5.8 5.8" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.7" y="4" width="18.6" height="12.4" rx="2.2" />
      <path d="M8.6 20.4h6.8M12 16.4v4" />
    </>
  ),
  celular: (
    <>
      <rect x="7.1" y="2.6" width="9.8" height="18.8" rx="2.4" />
      <path d="M10.9 5.6h2.2M11.1 18.5h1.8" />
    </>
  ),
  impresora: (
    <>
      <path d="M7.2 8.6V3.3h9.6v5.3" />
      <path d="M3.6 8.6h16.8a1.6 1.6 0 0 1 1.6 1.6v4.4a1.6 1.6 0 0 1-1.6 1.6h-1.6" />
      <path d="M5.2 16.2H3.6A1.6 1.6 0 0 1 2 14.6v-4.4" />
      <path d="M7.2 13.4h9.6v7.3H7.2z" />
    </>
  ),
  codigo: (
    <>
      <path d="M3.2 7.6V5.5A2.3 2.3 0 0 1 5.5 3.2h2.1M16.4 3.2h2.1a2.3 2.3 0 0 1 2.3 2.3v2.1M20.8 16.4v2.1a2.3 2.3 0 0 1-2.3 2.3h-2.1M7.6 20.8H5.5a2.3 2.3 0 0 1-2.3-2.3v-2.1" />
      <path d="M7.4 8.2v7.6M10.6 8.2v7.6M13.8 8.2v7.6M16.8 8.2v7.6" />
    </>
  ),
  candado: (
    <>
      <rect x="4.6" y="10.1" width="14.8" height="10.4" rx="2.2" />
      <path d="M8.2 10.1V7.4a3.8 3.8 0 0 1 7.6 0v2.7" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9.1" cy="8.2" r="3.4" />
      <path d="M2.9 19.8a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.4 5.4a3.4 3.4 0 0 1 0 6.4" />
      <path d="M17.5 14.6a6.2 6.2 0 0 1 3.6 5.2" />
    </>
  ),
  sucursal: (
    <>
      <path d="m3.6 9.6 1.5-5.4h13.8l1.5 5.4" />
      <path d="M4.4 9.6v10.2h15.2V9.6" />
      <path d="M3.6 9.6a2.5 2.5 0 0 0 5.1 0 2.5 2.5 0 0 0 5.1 0 2.5 2.5 0 0 0 5.1 0" />
      <path d="M9.7 19.8v-5.3h4.6v5.3" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 2.9 19.8 6v6.1c0 4.5-3.1 7.7-7.8 9-4.7-1.3-7.8-4.5-7.8-9V6L12 2.9Z" />
      <path d="m8.9 12 2.2 2.2 4-4.5" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 6.8V12l3.5 2.1" />
    </>
  ),
  correo: (
    <>
      <rect x="2.7" y="4.7" width="18.6" height="14.6" rx="2.3" />
      <path d="m3.5 6.7 8.5 5.9 8.5-5.9" />
    </>
  ),
  chevron: <path d="m6.2 9.6 5.8 5.8 5.8-5.8" />,
  ayuda: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M9.5 9.4a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.4v.4" />
      <circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  descarga: (
    <>
      <path d="M12 3.4v11.2" />
      <path d="m7.7 10.3 4.3 4.3 4.3-4.3" />
      <path d="M4.2 18.2v1.3a1.3 1.3 0 0 0 1.3 1.3h13a1.3 1.3 0 0 0 1.3-1.3v-1.3" />
    </>
  ),
  rayo: <path d="M13.3 2.6 5.2 13.5h5.6l-.7 7.9 8.7-11.2h-5.6l.1-7.6Z" />,
  documento: (
    <>
      <path d="M13.6 3.1H7.2a1.9 1.9 0 0 0-1.9 1.9v14a1.9 1.9 0 0 0 1.9 1.9h9.6a1.9 1.9 0 0 0 1.9-1.9V8.4l-5.1-5.3Z" />
      <path d="M13.4 3.3v5.2h5.3" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m15.9 15.9 4.5 4.5" />
    </>
  ),
  dinero: (
    <>
      <rect x="2.7" y="6.1" width="18.6" height="11.8" rx="2.2" />
      <circle cx="12" cy="12" r="2.7" />
      <path d="M6.1 9.8v4.4M17.9 9.8v4.4" />
    </>
  ),
  balanza: (
    <>
      <path d="M12 3.4v17.2M7.4 20.6h9.2M4.6 6.6h14.8" />
      <path d="M4.6 6.6 1.9 13.1a2.9 2.9 0 0 0 5.4 0L4.6 6.6Z" />
      <path d="m19.4 6.6-2.7 6.5a2.9 2.9 0 0 0 5.4 0l-2.7-6.5Z" />
    </>
  ),
  subida: (
    <>
      <path d="M12 20.6V9.4" />
      <path d="m7.6 13.5 4.4-4.4 4.4 4.4" />
      <path d="M4.2 6.4V5.1a1.3 1.3 0 0 1 1.3-1.3h13a1.3 1.3 0 0 1 1.3 1.3v1.3" />
    </>
  ),
  lapiz: (
    <>
      <path d="M16.4 3.7a2.3 2.3 0 0 1 3.3 3.3L8.2 18.5l-4.3 1 1-4.3L16.4 3.7Z" />
      <path d="m14.8 5.3 3.3 3.3" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.6 3.7 2.5 17.6a1.6 1.6 0 0 0 1.4 2.4h16.2a1.6 1.6 0 0 0 1.4-2.4L13.4 3.7a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.3v4.2" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
}

export function Icono({
  n,
  tam = 22,
  grosor = 1.6,
}: {
  n: NombreIcono
  tam?: number
  grosor?: number
}) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      {TRAZOS[n]}
    </svg>
  )
}
