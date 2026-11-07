/**
 * ShopNest Mobile — API client with offline mutation queue.
 *
 * Mirrors the web app's `src/lib/shopnest/client.ts`:
 *  • GET failures surface as `ApiClientError`.
 *  • Mutations (POST/PATCH/DELETE) that fail due to network loss are queued
 *    in AsyncStorage (`@shopnest_pending_queue`) and replayed automatically
 *    when connectivity returns (socket reconnect, `onFocus`/`onOnline`
 *    listeners, or a 30s timer in lib/realtime.ts).
 *  • A local change is NEVER presented as synchronized until the server
 *    confirms it (mutations only invalidate caches after a 2xx response, or
 *    after the queued mutation is successfully replayed).
 *
 * Auth: the Bearer token comes from `expo-secure-store` (lib/secure-storage),
 * NEVER AsyncStorage. The web app's HttpOnly cookie does not apply to native
 * clients per SECURITY.md §1.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getToken } from './secure-storage'

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

export class OfflineQueuedError extends Error {
  constructor() {
    super('Saved offline — will sync when you reconnect.')
    this.name = 'OfflineQueuedError'
  }
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export type QueuedMutation = {
  id: string
  method: 'POST' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  createdAt: number
  label?: string
}

const QUEUE_KEY = '@shopnest_pending_queue'

const listeners = new Set<() => void>()

export function subscribeQueue(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export async function getQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : []
  } catch {
    return []
  }
}

async function setQueue(q: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    // storage full — drop oldest
    if (q.length > 1) await setQueue(q.slice(-50))
  }
  listeners.forEach((l) => l())
}

async function enqueue(m: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<void> {
  const q = await getQueue()
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await setQueue([...q, { ...m, id, createdAt: Date.now() }])
}

let flushing = false
export async function flushQueue(): Promise<number> {
  if (flushing) return 0
  flushing = true
  let flushed = 0
  try {
    let queue = await getQueue()
    for (const m of queue) {
      try {
        const token = await getToken()
        const res = await fetch(m.url, {
          method: m.method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(m.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: m.body !== undefined ? JSON.stringify(m.body) : undefined,
        })
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408)) {
          queue = (await getQueue()).filter((q) => q.id !== m.id)
          await setQueue(queue)
          flushed++
        } else {
          break
        }
      } catch {
        break // still offline
      }
    }
  } finally {
    flushing = false
  }
  return flushed
}

// ─── Fetch wrapper ───────────────────────────────────────────────────────────

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** human-readable label for offline queue UI */
  label?: string
  /** mutations that shouldn't be queued (e.g. auth) */
  noOfflineQueue?: boolean
}

/** The configured API base URL (no trailing slash). */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '')

function buildUrl(url: string): string {
  // Allow absolute URLs (rare) and gateway-relative paths.
  if (/^https?:\/\//i.test(url)) return url
  if (!API_BASE) {
    // Fall back to a same-origin relative path so dev builds don't crash —
    // callers will get a clear network error in dev.
    return url
  }
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

export async function api<T = unknown>(url: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const token = await getToken()
  let res: Response
  try {
    res = await fetch(buildUrl(url), {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch (err) {
    // Network failure / no connection. GET surfaces as an error; mutations
    // are queued (unless explicitly disabled, e.g. auth).
    if (method !== 'GET' && !opts.noOfflineQueue) {
      await enqueue({ method, url: buildUrl(url), body: opts.body, label: opts.label })
      throw new OfflineQueuedError()
    }
    throw new ApiClientError(0, 'Network error — check your connection.')
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // no body
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new ApiClientError(res.status, message)
  }

  // successful mutation → try flushing anything pending
  if (method !== 'GET' && (await getQueue()).length > 0) {
    flushQueue().catch(() => {})
  }

  return data as T
}

/** Sliding session refresh — extends the TTL when near expiry. */
export async function refreshSession(): Promise<void> {
  try {
    await api('/api/auth/refresh', { method: 'POST', noOfflineQueue: true })
  } catch {
    // 401 (no/expired session) and network errors are both non-fatal here.
  }
}
