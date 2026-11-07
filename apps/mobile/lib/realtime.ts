/**
 * ShopNest Mobile — realtime sync via socket.io-client.
 *
 * Mirrors the web app's `src/lib/shopnest/realtime.ts`:
 *  • Connects once to `${EXPO_PUBLIC_SOCKET_BASE}/?XTransformPort=3003`
 *    (path `/` so the Caddy gateway can route it).
 *  • Joins rooms `hh:<id>` for every household the user is a member of.
 *  • On server-confirmed change events, invalidates the matching react-query
 *    cache keys so every device converges (duplicate events are harmless —
 *    refetch is idempotent).
 *  • Tracks connection status + pending offline-queue count for the banner.
 *  • Replays the offline mutation queue on (re)connect.
 *  • Polls `activity` every 30s as a fallback convergence path.
 */

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { flushQueue, getQueue, subscribeQueue } from './api-client'

export type ConnectionStatus = 'connecting' | 'live' | 'offline'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

const SOCKET_BASE =
  process.env.EXPO_PUBLIC_SOCKET_BASE || process.env.EXPO_PUBLIC_API_BASE || ''

export function buildSocketUrl(): string {
  if (!SOCKET_BASE) return '/?XTransformPort=3003'
  return `${SOCKET_BASE}/?XTransformPort=3003`
}

// Mirrors the web's EVENT_TO_KEYS map. The mobile app keys are kept as plain
// strings to match how the react-query hooks build their key arrays.
const EVENT_TO_KEYS: Record<string, string[]> = {
  'lists:changed': ['lists', 'list'],
  'items:changed': ['lists', 'list', 'history'],
  'stores:changed': ['stores', 'lists', 'list'],
  'products:changed': ['products'],
  'events:changed': ['events'],
  'activity:changed': ['activity'],
  'household:changed': ['me', 'household', 'members'],
}

/**
 * Realtime sync hook.
 *
 * @param householdIds the user's household ids (joins `hh:<id>` rooms).
 * @param enabled      whether to connect (false until the user is authed).
 */
export function useRealtime(householdIds: string[], enabled: boolean) {
  const queryClient = useQueryClient()
  const idsKey = householdIds.slice().sort().join(',')
  const statusRef = useRef<ConnectionStatus>('connecting')
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  // Open the socket once per enabled session.
  useEffect(() => {
    if (!enabled) return

    if (!socket) {
      socket = io(buildSocketUrl(), {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        timeout: 10000,
      })
    }
    const s = socket
    setStatus('connecting')
    statusRef.current = 'connecting'

    const emitStatus = (next: ConnectionStatus) => {
      statusRef.current = next
      setStatus(next)
    }

    const onConnect = () => {
      emitStatus('live')
      s.emit('join', { householdIds: idsKey ? idsKey.split(',') : [] })
      flushQueue().then((n) => {
        if (n > 0) queryClient.invalidateQueries()
      })
    }
    const onDisconnect = () => emitStatus('offline')

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)

    const invalidate = (event: string) => {
      const keys = EVENT_TO_KEYS[event]
      if (!keys) return
      for (const key of keys) queryClient.invalidateQueries({ queryKey: [key] })
    }
    for (const event of Object.keys(EVENT_TO_KEYS)) s.on(event, () => invalidate(event))

    // Fallback convergence paths.
    const timer = setInterval(async () => {
      if ((await getQueue()).length > 0) {
        const n = await flushQueue()
        if (n > 0) queryClient.invalidateQueries()
      } else {
        queryClient.invalidateQueries({ queryKey: ['activity'] })
      }
    }, 30_000)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      for (const event of Object.keys(EVENT_TO_KEYS)) s.off(event)
      clearInterval(timer)
    }
  }, [enabled, idsKey, queryClient])

  // Re-join rooms when household membership changes.
  useEffect(() => {
    if (socket?.connected && idsKey) {
      socket.emit('join', { householdIds: idsKey.split(',') })
    }
  }, [idsKey])

  // Surface the queue count to the connection banner.
  const [queueCount, setQueueCount] = useState(0)
  useEffect(() => {
    const unsub = subscribeQueue(() => {
      getQueue().then((q) => setQueueCount(q.length))
    })
    getQueue().then((q) => setQueueCount(q.length))
    return unsub
  }, [])

  return { status, queueCount }
}
