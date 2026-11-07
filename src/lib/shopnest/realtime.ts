'use client'

import { io, type Socket } from 'socket.io-client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { flushQueue, getQueue, subscribeQueue } from '@/lib/shopnest/client'

export type ConnectionStatus = 'connecting' | 'live' | 'offline'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

const EVENT_TO_KEYS: Record<string, string[]> = {
  'lists:changed': ['lists', 'list'],
  'items:changed': ['lists', 'list', 'history', 'outstanding'],
  'stores:changed': ['stores', 'lists', 'list'],
  'products:changed': ['products'],
  'events:changed': ['events'],
  'activity:changed': ['activity'],
  'household:changed': ['me', 'household', 'members'],
}

/**
 * Realtime sync hook:
 * - Connects once, joins rooms for all of the user's households.
 * - Server-confirmed change events invalidate the matching query keys so
 *   every device converges (duplicate events are harmless — refetch is idempotent).
 * - Tracks connection status + pending offline queue count.
 * - Also refetches on window focus and every 30s as a fallback path.
 */
export function useRealtime(householdIds: string[], enabled: boolean) {
  const queryClient = useQueryClient()
  const idsKey = householdIds.slice().sort().join(',')

  useEffect(() => {
    if (!enabled) return

    // create socket once
    if (!socket) {
      socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        timeout: 10000,
      })
    }
    const s = socket

    const onConnect = () => {
      s.emit('join', { householdIds: idsKey ? idsKey.split(',') : [] })
      window.dispatchEvent(new CustomEvent('shopnest:status', { detail: 'live' }))
      flushQueue().then((n) => {
        if (n > 0) queryClient.invalidateQueries()
      })
    }
    const onDisconnect = () => {
      window.dispatchEvent(new CustomEvent('shopnest:status', { detail: 'offline' }))
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)

    const invalidate = (event: string) => {
      const keys = EVENT_TO_KEYS[event]
      if (!keys) return
      for (const key of keys) queryClient.invalidateQueries({ queryKey: [key] })
    }
    for (const event of Object.keys(EVENT_TO_KEYS)) s.on(event, () => invalidate(event))

    // fallback convergence paths
    const onFocus = () => queryClient.invalidateQueries()
    const onOnline = () => {
      flushQueue().then((n) => {
        if (n > 0) queryClient.invalidateQueries()
      })
    }
    const timer = setInterval(() => {
      if (getQueue().length > 0) onOnline()
      else queryClient.invalidateQueries({ queryKey: ['activity'] })
    }, 30_000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      for (const event of Object.keys(EVENT_TO_KEYS)) s.off(event)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      clearInterval(timer)
    }
  }, [enabled, idsKey, queryClient])

  // re-join rooms when household membership changes
  useEffect(() => {
    if (socket?.connected && idsKey) {
      socket.emit('join', { householdIds: idsKey.split(',') })
    }
  }, [idsKey])
}

export function useConnectionStatus(onChange: (status: ConnectionStatus) => void) {
  useEffect(() => {
    const handler = (e: Event) => onChange((e as CustomEvent).detail)
    window.addEventListener('shopnest:status', handler)
    const unsub = subscribeQueue(() => onChange(getQueue().length > 0 ? 'offline' : 'live'))
    return () => {
      window.removeEventListener('shopnest:status', handler)
      unsub()
    }
  }, [onChange])
}
