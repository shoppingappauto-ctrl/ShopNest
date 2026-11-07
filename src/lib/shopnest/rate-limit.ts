/**
 * Simple in-memory sliding-window rate limiter (per process).
 * Suitable for the single-instance sandbox deployment; swap for a shared
 * store if the app is ever scaled horizontally.
 */

type Bucket = number[]

const buckets = new Map<string, Bucket>()

/** Returns true when the action is allowed; false when the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= limit) {
    buckets.set(key, arr)
    return false
  }
  arr.push(now)
  buckets.set(key, arr)
  // opportunistic cleanup
  if (buckets.size > 500) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}

export function clientKey(req: Request, scope: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  return `${scope}:${ip}`
}
