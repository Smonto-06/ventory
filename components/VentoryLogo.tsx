interface VentoryLogoProps {
  variant?: 'icon' | 'wordmark' | 'full'
  iconSize?: number
}

function VentoryIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path
        d="M7 9L16 23L25 9"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
        style={{ fontFamily: 'var(--font-brand), sans-serif' }}
      >
        <span className="text-blue-600">V</span>
        <span className="text-gray-900">entory</span>
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <VentoryIcon size={iconSize} />
      <span
        className="text-xl font-bold tracking-tight leading-none"
        style={{ fontFamily: 'var(--font-brand), sans-serif' }}
      >
        <span className="text-blue-600">V</span>
        <span className="text-gray-900">entory</span>
      </span>
    </div>
  )
}
