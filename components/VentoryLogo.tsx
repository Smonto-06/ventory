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
        <linearGradient id="ventory-icon-r" x1="31.6" y1="4.4" x2="16" y2="25.8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8D5CF7" />
          <stop offset="1" stopColor="#6B3BEF" />
        </linearGradient>
        <linearGradient id="ventory-icon-la" x1="4.8" y1="7" x2="13" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2FE8A9" />
          <stop offset="1" stopColor="#2AC6E8" />
        </linearGradient>
        <linearGradient id="ventory-icon-lb" x1="11.8" y1="18.4" x2="16.4" y2="26.4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3FC0EC" stopOpacity="0.62" />
          <stop offset="0.7" stopColor="#4B85F2" stopOpacity="0.85" />
          <stop offset="1" stopColor="#4E68F5" />
        </linearGradient>
      </defs>
      <path d="M16 25.8L31.6 4.4" stroke="url(#ventory-icon-r)" strokeWidth="7.2" strokeLinecap="round" />
      <path d="M4.8 7L12.4 19.5" stroke="url(#ventory-icon-la)" strokeWidth="7.2" strokeLinecap="round" />
      <path d="M12.4 19.5L16.4 26.4" stroke="url(#ventory-icon-lb)" strokeWidth="7.2" strokeLinecap="round" />
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
