'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function timeAgo(iso: string | number | Date | null | undefined): string {
  if (iso === null || iso === undefined || iso === 0 || iso === '') return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function UserChip({
  name,
  color,
  size = 24,
  className,
}: {
  name: string
  color: string
  size?: number
  className?: string
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <Avatar className={cn('inline-flex', className)} style={{ width: size, height: size }}>
      <AvatarFallback style={{ backgroundColor: color }} className="text-white font-semibold" >
        <span style={{ fontSize: size * 0.38 }}>{initials}</span>
      </AvatarFallback>
    </Avatar>
  )
}

export function StatusBadge({ status, substitutedWith }: { status: string; substitutedWith?: string | null }) {
  if (status === 'PURCHASED')
    return (
      <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
        Purchased
      </Badge>
    )
  if (status === 'UNAVAILABLE')
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
        Unavailable
      </Badge>
    )
  if (status === 'SUBSTITUTED')
    return (
      <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-600">
        {substitutedWith ? `Bought ${substitutedWith}` : 'Substituted'}
      </Badge>
    )
  return null
}
