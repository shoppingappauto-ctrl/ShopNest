import { cn } from '@/lib/utils'

/**
 * ShopNest mark: a shopping bag nested inside a home — "your family, your shopping, one place".
 * Inline SVG so it renders crisply at any size without an extra network request.
 */
export function ShopNestLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" className="fill-primary" />
      {/* roof / home */}
      <path d="M10 22L24 11L38 22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* bag */}
      <path
        d="M16 21h16l-1.6 12.2a2.4 2.4 0 0 1-2.38 2.1H19.98a2.4 2.4 0 0 1-2.38-2.1L16 21Z"
        stroke="white"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* bag handles */}
      <path d="M20 21v-2.2a4 4 0 0 1 8 0V21" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      {/* check inside bag */}
      <path d="M21 28.5l2.4 2.4 4-4.4" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShopNestWordmark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <ShopNestLogo size={size} />
      <span className="font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
        ShopNest
      </span>
    </span>
  )
}
