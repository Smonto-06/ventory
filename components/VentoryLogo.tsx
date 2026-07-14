interface VentoryLogoProps {
  variant?: 'icon' | 'wordmark' | 'full'
  iconSize?: number
}

function VentoryIcon({ size = 32 }: { size?: number }) {
  // Logo oficial: chulo en V violeta→azul con trazo turquesa→azul al frente
  return (
    <svg
      width={size}
      height={(size * 32) / 36}
      viewBox="0 0 36 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ventory-icon-r" x1="31" y1="5" x2="15" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#4E6AF3" />
        </linearGradient>
        <linearGradient id="ventory-icon-l" x1="5" y1="8" x2="15" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1FE0A6" />
          <stop offset="0.55" stopColor="#2CC8DB" />
          <stop offset="1" stopColor="#3B9DF8" />
        </linearGradient>
      </defs>
      <path d="M15 26L31 5" stroke="url(#ventory-icon-r)" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8L15 26" stroke="url(#ventory-icon-l)" strokeOpacity="0.92" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function VentoryLogo({ variant = 'full', iconSize = 32 }: VentoryLogoProps) {
  if (variant === 'icon') {
    return <VentoryIcon size={iconSize} />
  }

  if (variant === 'wordmark') {
    return (
      <span
        className="text-2xl font-bold tracking-tight"
        style={{ fontFamily: 'var(--font-poppins), var(--font-brand), sans-serif', color: '#111A34' }}
      >
        Ventory
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <VentoryIcon size={iconSize} />
      <span
        className="text-xl font-bold tracking-tight leading-none"
        style={{ fontFamily: 'var(--font-poppins), var(--font-brand), sans-serif', color: '#111A34' }}
      >
        Ventory
      </span>
    </div>
  )
}
