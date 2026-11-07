/**
 * Server-side realtime broadcasting.
 *
 * After a mutation is persisted, the API broadcasts an event to the
 * household's socket.io room via the localhost-only internal emit API
 * of the ShopNest realtime service (mini-services/shopnest-socket).
 *
 * Delivery is best-effort: if the realtime service is down, clients
 * still converge via polling/focus refetch.
 */

const INTERNAL_EMIT_URL = 'http://127.0.0.1:3004/internal/emit'

export type SyncEventType =
  | 'lists:changed'
  | 'items:changed'
  | 'stores:changed'
  | 'products:changed'
  | 'events:changed'
  | 'activity:changed'
  | 'household:changed'

export function broadcastHousehold(
  householdId: string,
  event: SyncEventType,
  payload: Record<string, unknown> = {}
): void {
  const body = JSON.stringify({
    room: `hh:${householdId}`,
    event,
    payload: { ...payload, ts: Date.now() },
  })

  fetch(INTERNAL_EMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(1500),
  }).catch(() => {
    // best-effort only — never fail the API request because of realtime fanout
  })
}

export function broadcastMany(
  householdIds: string[],
  event: SyncEventType,
  payload: Record<string, unknown> = {}
): void {
  for (const id of householdIds) broadcastHousehold(id, event, payload)
}
