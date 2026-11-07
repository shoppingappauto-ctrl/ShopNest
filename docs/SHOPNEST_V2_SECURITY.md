# ShopNest V2 — Security Model

Scope: what the code actually enforces today, plus honestly-labeled gaps. Code refs: `src/lib/shopnest/auth.ts`, `api-helpers.ts`, `rate-limit.ts`, `compress.ts`, `mini-services/shopnest-socket/index.ts`.

---

## 1. Authentication

| Aspect | Implementation |
|---|---|
| Credential check | bcrypt compare (cost 10) against `User.passwordHash` |
| Session token | Opaque token (two concatenated UUIDs, 68 chars) stored as a `Session` row; 30-day TTL; expiry checked on every request |
| Primary web session (same-site) | `sn_session` cookie: `httpOnly`, `SameSite=Lax`, `Secure`, `path=/`, `maxAge` 30d. **No token is exposed to JavaScript** — XSS cannot exfiltrate it. This is the path used by Safari, Chrome, Firefox and mobile-web top-level visits. |
| Cross-origin iframe fallback | A `Lax` cookie is neither set nor sent inside a cross-origin iframe (e.g. the embedded preview panel), so login/register/refresh also return the opaque token in the JSON body. The web client persists it **only to `sessionStorage`** (tab-scoped — cleared on tab close, never persistent) plus an in-memory copy, and sends `Authorization: Bearer <token>`. The server prefers the header, falls back to the cookie. |
| Storage-unavailable fallback | If `sessionStorage` is unavailable (private mode / disabled storage) the token is kept in memory only; a reload ends the session and the user signs in again. Graceful, never silent. |
| Native mobile clients | The same opaque token is stored in the OS Keychain/Keystore via `expo-secure-store` (apps/mobile), never in JS-accessible web storage. |
| Safari fix | The previous build used CHIPS `Partitioned` cookies, which **Safari does not support** — login silently failed on Safari. CHIPS has been removed in favour of `SameSite=Lax` (supported everywhere) for first-party web, with the sessionStorage Bearer fallback only for the cross-origin iframe case. |
| Session refresh | `POST /api/auth/refresh` performs sliding TTL extension: if the current session expires within 7 days, its `expiresAt` is pushed forward by 30 days and the cookie is re-stamped. No token rotation (no new credential issued). The client calls it once on app load. |
| Suspension | `getSessionUser` returns null for suspended users → effectively instant lockout on next request |
| Logout | Deletes the `Session` row (token from header or cookie), clears the cookie, and the client drops any `sessionStorage`/in-memory token (and wipes any legacy `localStorage` token from the previous build) |
| Last-active | `lastActiveAt` touched at most once per 60s (fire-and-forget) — feeds DAU/WAU/MAU |

Known trade-offs (actual state): inside the cross-origin iframe the sessionStorage token is readable by any injected script (XSS amplification) — this is the deliberate, documented cost of the only feasible fallback when cookies are blocked; it is tab-scoped (not a long-lived credential) and the same-site first-party path keeps no client-readable token at all. `SameSite=Lax` is the recommended default; a CSRF token remains a production defense-in-depth item (cross-site JSON mutations currently fail CORS preflight and non-JSON bodies fail zod parsing, so the CSRF surface is low).

## 2. Authorization (household scoping)

Every household-scoped route resolves membership **from the DB** before reading/writing data. Helpers:

| Helper | Behavior |
|---|---|
| `requireUser()` | 401 unless a valid, non-expired, non-suspended session exists |
| `requireHouseholdAccess(userId, householdId)` | 403 unless an `HouseholdMember` row exists; returns `{ role, isAdmin }` where `isAdmin = role ∈ {OWNER, ADMIN}` |
| `requireHouseholdManager(userId, householdId)` | 403 unless OWNER/ADMIN (rename, invite management, role changes, member removal) |
| `jsonError(err)` | Maps `ApiError` → `{ error }` with its status; anything else → generic 500 (no stack leakage) |

Ownership nuances enforced in routes: only OWNER deletes a household; OWNER's role/membership cannot be changed or removed; admins cannot remove themselves (must use "Leave household"); only the shopper who raised a confirmation can cancel it.

### Roles & caregiver access
`OWNER | ADMIN | MEMBER | CAREGIVER`. CAREGIVER is delegated shopping access for the same data (lists, items, pantry, photos) with **no manager powers** — `requireHouseholdAccess` accepts any member; only manager-gated routes exclude CAREGIVER/MEMBER. Item/photo/comment routes are member-level by design (family collaboration, not per-user ACLs).

### Row-level security note
**SQLite has no RLS.** Tenant isolation is enforced exclusively in the API layer: every query is filtered by a `householdId` that was just authorization-checked, and cross-household IDs (stores, products, lists) are validated to belong to the household before use (`findFirst({ where: { id, householdId } })`). Moving to Postgres would not change the enforcement point today — the API layer is the security boundary.

## 3. Photo privacy & validation

- Storage: base64 `dataUrl` **in the DB**, never on public object storage; access only via household-authorized API paths (photo rows are reached through item → household checks).
- Client pre-processes with `compressImageFile` (max 1000px long edge, JPEG q≈0.72) — reduces cost and kills exotic payloads early.
- Server whitelist: `RASTER_MIME = /^data:image\/(png|jpe?g|webp|gif);base64,/` — **SVG is rejected** (SVG can carry scripts; the previous version accepted it).
- Size cap ~700 KB dataURL (~500 KB binary after compression); 8 photos/item quota; messages match the enforced rules.

## 4. Rate limiting

In-memory sliding window (`rateLimit(key, limit, windowMs)`), keyed `scope:ip` from `x-forwarded-for` / `x-real-ip`. Applied to abuse-prone unauthenticated surface:

| Endpoint | Limit |
|---|---|
| `POST /api/demo/seed` | 5 / min / IP (fixed demo credentials are the target being protected) |

Honest limits: per-process only (multi-instance would fragment buckets), and unauthenticated endpoints without limits (login/register) rely on bcrypt cost + sandbox exposure. Production hardening: shared store (Redis), limits on auth endpoints.

## 5. Admin portal guards

- `GET /api/admin/stats`, user management routes require `user.isAdmin` (403 otherwise).
- **Last-admin guard**: demoting (`isAdmin:false`) or suspending the final active platform admin returns 409 — the portal can never lock itself out.

## 6. Realtime security

- Public socket endpoint (port 3003) and the internal emit API (port 3004, localhost-only, 256 KB body guard) are separate listeners; only 3003 is proxied via Caddy.
- **`join` is unauthenticated**: any connected client can join any `hh:<id>` room by guessing/knowing an ID. Payloads are change notifications (no PII beyond item/store names); IDs are opaque cuids. Acceptable for the single-tenant sandbox; **hardening item for production**: verify the session token and membership before `socket.join`.
- Broadcast fanout is best-effort with a 1.5s timeout and can never fail the triggering API request.

## 7. Entitlements / plan verification status

- `Household.plan` flags `FREE | PLUS`; `PLUS_PRICE_PER_MONTH = 3.99`.
- `POST /api/households/[id]/plan` returns **402** with `paymentsEnabled: false` — no payment provider is wired; no plan-gated feature is secretly active.
- Admin MRR is computed from plan flags only and is explicitly labeled "Payments are disabled in this build" in the stats payload.
- **Status: entitlement flags exist; payment verification, receipt validation, and true entitlement enforcement are pending** (P5) — there is nothing to bypass because nothing charges.

## 8. Input validation

Every mutating route parses its body through a zod schema (`parseBody`): bounded string lengths (names ≤80, notes ≤300), positive-bounded quantities, enum-checked categories/units/statuses, integer-bounded cents (≤100,000,000). Failures surface as 400-class errors with the first issue's path — no raw Prisma errors reach clients.

## 9. Hardening backlog (real gaps, ordered)

| # | Item | Why it matters | Blocking? |
|---|---|---|---|
| 1 | Authenticated socket `join` (verify session + membership server-side) | Room membership is trust-on-connect today | For public production: yes |
| 2 | Shared rate-limit store (Redis or DB) | Current limiter is per-process; buckets fragment behind N instances | For scaled deployment: yes |
| 3 | Rate limits on login/register endpoints | Brute-force surface currently bounded only by bcrypt cost & exposure | For public production: yes |
| 4 | CSRF token or `SameSite=Lax` first-party-only cookie mode | Defense-in-depth beyond CORS/zod JSON parsing | Recommended |
| 5 | Session revocation UI / token rotation | 30-day tokens live until expiry or logout | Recommended |
| 6 | Photo virus/malware scanning (content sniffing beyond MIME prefix) | Whitelist checks the declared data URL, not decoded bytes | Recommended for scale |
| 7 | Client telemetry for voice/photo errors | Needed to operate the v2 admin metrics honestly | Pending (P5) |

Items 1–3 are the ones the AUDIT doc also lists as remaining gaps; nothing in this table is claimed as done.
