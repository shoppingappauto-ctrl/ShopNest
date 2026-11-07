'use client'

import { useCallback, useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useConnectionStatus, type ConnectionStatus } from '@/lib/shopnest/realtime'
import { getQueue } from '@/lib/shopnest/client'

export function SyncStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [pending, setPending] = useState(0)

  const handle = useCallback((s: ConnectionStatus) => {
    setStatus(s)
    setPending(getQueue().length)
  }, [])

  useConnectionStatus(handle)

  const label =
    status === 'live' ? (pending > 0 ? `${pending} pending sync` : 'Live') : status === 'offline' ? 'Offline' : 'Connecting…'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            role="status"
            aria-label={`Sync status: ${label}`}
          >
            {status === 'live' && pending === 0 && (
              <>
                <Wifi className="h-3 w-3 text-primary" />
                <span className="text-primary hidden sm:inline">Live</span>
              </>
            )}
            {(status === 'offline' || pending > 0) && (
              <>
                <WifiOff className="h-3 w-3 text-amber-600" />
                <span className="text-amber-600">{pending > 0 ? label : 'Offline'}</span>
              </>
            )}
            {status === 'connecting' && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground hidden sm:inline">Syncing…</span>
              </>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {pending > 0
            ? `${pending} change${pending > 1 ? 's' : ''} waiting to sync — they'll be sent automatically when you're back online.`
            : 'Changes sync instantly with everyone in your household.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function RetryHint() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      changes retry automatically
    </span>
  )
}
