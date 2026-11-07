'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell } from 'lucide-react'
import { useActivity } from '@/lib/shopnest/hooks'
import { UserChip, timeAgo } from '@/components/shopnest/ui-bits'
import type { Activity } from '@/lib/shopnest/types'

const ICONS: Record<string, string> = {
  ITEM_ADDED: '➕',
  ITEM_PURCHASED: '✅',
  ITEM_STATUS: 'ℹ️',
  ITEM_REMOVED: '🗑️',
  COMMENT: '💬',
  PHOTO: '📷',
  LIST_CREATED: '📋',
  MEMBER_JOINED: '👋',
  EVENT: '📅',
  HOUSEHOLD: '🏠',
  STORE: '🏬',
  PRODUCT: '⭐',
}

export function ActivityFeed({ householdId, maxHeight = 'h-72' }: { householdId: string; maxHeight?: string }) {
  const { data, isLoading } = useActivity(householdId)
  const activities = data?.activities ?? []

  if (isLoading) {
    return (
      <div className="space-y-2 p-1">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <Bell className="h-5 w-5" />
        <p className="text-sm">Household activity will appear here.</p>
      </div>
    )
  }

  return (
    <ScrollArea className={`${maxHeight} scrollbar-slim`}>
      <ul className="space-y-1 pr-3">
        {activities.map((a: Activity) => (
          <li key={a.id} className="flex items-start gap-2.5 py-1.5">
            <span className="text-base leading-6 shrink-0" aria-hidden>
              {ICONS[a.type] ?? '•'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 break-words">{a.message}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
