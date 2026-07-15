import Image from 'next/image'

interface VentoryLogoProps {
  variant?: 'icon' | 'wordmark' | 'full'
  iconSize?: number
}

function VentoryIcon({ size = 32 }: { size?: number }) {
  // Logo oficial (archivo de marca en public/brand/)
  return (
    <Image
      src="/brand/ventory-icon.png"
      alt="Ventory"
      width={size}
      height={size}
      style={{ display: 'block', objectFit: 'contain' }}
    />
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
