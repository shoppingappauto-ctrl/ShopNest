import { refreshSessionIfNeeded, jsonError } from '@/lib/shopnest/auth'

/**
 * Sliding session refresh. Called by the client on app load (and after long
 * idle) to keep an active session alive without re-issuing a credential.
 * Extends the TTL only when the session is within 7 days of expiry.
 */
export async function POST() {
  try {
    const { refreshed, expiresAt } = await refreshSessionIfNeeded(7)
    return Response.json({ ok: true, refreshed, expiresAt })
  } catch (error) {
    return jsonError(error)
  }
}
