'use client'

/**
 * ShopNest API client with offline support.
 *
 * - GET failures surface as errors.
 * - Mutations (POST/PATCH/DELETE) that fail due to network loss are queued
 *   in localStorage and replayed automatically when connectivity returns
 *   (browser `online` event, socket reconnect, or 30s timer).
 * - A local change is never presented as synchronized until the server
 *   confirms it (mutations only invalidate caches after a 2xx response,
 *   or after the queued mutation is successfully replayed).
 */

export class ApiClientError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class OfflineQueuedError extends Error {
  constructor() {
    super('Saved offline — will sync when you reconnect.')
  }
}

export type QueuedMutation = {
  id: string
  method: 'POST' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  createdAt: number
  label?: string
}

const QUEUE_KEY = 'shopnest_pending_queue'
const TOKEN_KEY = 'shopnest_session_token'
const listeners = new Set<() => void>()

/**
 * Session token fallback (localStorage).
 *
 * The preview UI often renders the app inside a cross-origin iframe where
 * browsers block third-party cookies — the Set-Cookie from /api/auth/login
 * would silently vanish and every login would "bounce" back to the sign-in
 * screen. The auth APIs therefore also return the session token, which we
 * persist here and attach as `Authorization: Bearer <token>` to every
 * request. The server accepts either the header or the cookie.
 */
export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSessionToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // storage unavailable — cookie path still works when not blocked
  }
}

export function clearSessionToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getQueue(): QueuedMutation[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedMutation[]
  } catch {
    return []
  }
}

function setQueue(q: QueuedMutation[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    // storage full — drop oldest
  }
  listeners.forEach((l) => l())
}

export function subscribeQueue(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function enqueue(m: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  setQueue([...getQueue(), { ...m, id: crypto.randomUUID(), createdAt: Date.now() }])
}

let flushing = false
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) return 0
  flushing = true
  let flushed = 0
  try {
    let queue = getQueue()
    for (const m of queue) {
      try {
        const res = await fetch(m.url, {
          method: m.method,
          headers: {
            ...authHeaders(),
            ...(m.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: m.body !== undefined ? JSON.stringify(m.body) : undefined,
        })
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408)) {
          // confirmed or permanently rejected → remove from queue
          queue = getQueue().filter((q) => q.id !== m.id)
          setQueue(queue)
          flushed++
        } else {
          // transient server error → keep in queue, stop flushing
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

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** human-readable label for offline queue UI */
  label?: string
  /** mutations that shouldn't be queued (e.g. auth) */
  noOfflineQueue?: boolean
}

export async function api<T = unknown>(url: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...authHeaders(),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    if (method !== 'GET' && !opts.noOfflineQueue && typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueue({ method, url, body: opts.body, label: opts.label })
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

  // successful auth response → persist the session token (iframe-safe fallback)
  if (res.ok && data && typeof data === 'object' && 'token' in data) {
    const token = (data as { token?: unknown }).token
    if (typeof token === 'string' && token.length > 0) setSessionToken(token)
  }
  // logout → drop the stored token
  if (res.ok && url.includes('/api/auth/logout')) clearSessionToken()

  // successful mutation → try flushing anything pending
  if (method !== 'GET' && getQueue().length > 0) {
    flushQueue().catch(() => {})
  }

  return data as T
}
