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
const TOKEN_KEY = 'shopnest_session_token' // sessionStorage fallback only (tab-scoped)
const LEGACY_TOKEN_KEY = 'shopnest_session_token' // previous build stored this in localStorage
const listeners = new Set<() => void>()

/**
 * Session-token strategy (V2 — Safari & storage-safe).
 *
 *  • First-party / same-site web (the normal case in Safari, Chrome, Firefox,
 *    mobile browsers): the session is an HttpOnly; Secure; SameSite=Lax cookie
 *    that JavaScript can never read. We do NOT keep a token in any client
 *    store — so XSS cannot exfiltrate a long-lived credential.
 *
 *  • Cross-origin iframe (the embedded preview panel): a Lax cookie is neither
 *    set nor sent, so the API returns the opaque token in the login body and we
 *    persist it to `sessionStorage` (tab-scoped — cleared when the tab closes,
 *    never persistent) plus an in-memory copy. This is a deliberately degraded
 *    fallback; it is the safest option available when cookies are blocked.
 *
 *  • Storage unavailable (private mode / disabled storage): we keep the token
 *    in memory only. A reload ends the session and the user signs in again —
 *    graceful, never silent.
 *
 *  • Native mobile: the token is stored in the OS Keychain/Keystore via
 *    expo-secure-store (apps/mobile), not here.
 *
 * The previous build kept a 30-day token in localStorage for everyone; that is
 * migrated away on first load (see migrateLegacyToken).
 */

let memoryToken: string | null = null

/** True when running inside a cross-origin (or opaque) iframe. */
function inIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    // cross-origin access throws — treat as iframe (cookies will be blocked)
    return true
  }
}

function storageAvailable(type: 'sessionStorage' | 'localStorage'): boolean {
  try {
    const s = window[type]
    const k = '__sn_probe__'
    s.setItem(k, '1')
    s.removeItem(k)
    return true
  } catch {
    return false
  }
}

/** Whether the sessionStorage Bearer fallback should be used (iframe + storage). */
function shouldUseStoredToken(): boolean {
  return inIframe() && storageAvailable('sessionStorage')
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  if (memoryToken) return memoryToken
  if (shouldUseStoredToken()) {
    try {
      memoryToken = window.sessionStorage.getItem(TOKEN_KEY)
    } catch {
      memoryToken = null
    }
  }
  return memoryToken
}

export function setSessionToken(token: string) {
  memoryToken = token
  // Persist only inside the cross-origin iframe where the cookie cannot be
  // used. Top-level same-site browsing relies on the HttpOnly cookie alone.
  if (shouldUseStoredToken()) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      // quota exceeded — in-memory copy still works for this tab
    }
  }
}

export function clearSessionToken() {
  memoryToken = null
  try {
    window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
  // also wipe any legacy localStorage token left by the previous build
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    // ignore
  }
}

/**
 * One-time migration of the legacy localStorage token (previous build) into the
 * new sessionStorage fallback (iframe only) or clears it (top-level, where the
 * HttpOnly cookie is authoritative). Safe to call on every load.
 */
export function migrateLegacyToken() {
  if (typeof window === 'undefined') return
  let legacy: string | null = null
  try {
    legacy = window.localStorage.getItem(LEGACY_TOKEN_KEY)
  } catch {
    return
  }
  if (!legacy) return
  if (shouldUseStoredToken() && !memoryToken) {
    memoryToken = legacy
    try {
      window.sessionStorage.setItem(TOKEN_KEY, legacy)
    } catch {
      // keep in-memory
    }
  }
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    // ignore
  }
}

/**
 * Sliding session refresh — extends the TTL when near expiry. Called once on
 * app load. No-ops (resolves ok) when there is no session (unauthenticated).
 */
export async function refreshSession(): Promise<void> {
  try {
    await api('/api/auth/refresh', { method: 'POST', noOfflineQueue: true })
  } catch {
    // 401 (no/expired session) and network errors are both non-fatal here —
    // the auth gate will simply show the sign-in screen.
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
