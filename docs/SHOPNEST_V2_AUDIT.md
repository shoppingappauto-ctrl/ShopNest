# ShopNest V2 — Engineering Audit

Status markers: ✅ implemented & verified · 🟡 partial · ⏳ pending / not built.
Everything below reflects the **actual repository state**, verified against source. No aspirational claims.

---

## 1. Architecture summary

| Component | Tech | Notes |
|---|---|---|
| Web app + API | Next.js 16 (App Router) + TypeScript | All routes under `src/app/api/**`, zod-validated bodies |
| Database | Prisma 6 + SQLite | Single file `db/custom.db`, no migrations in repo (`db:push` workflow) |
| Realtime | Socket.io mini-service (`mini-services/shopnest-socket`) | Public port 3003 (via Caddy `/?XTransformPort=3003`), localhost-only internal emit API on 3004 |
| Auth | Custom session auth | `sn_session` httpOnly cookie (SameSite=None; Secure; Partitioned — CHIPS) + `Authorization: Bearer` fallback |
| Client state | TanStack Query + socket-driven cache invalidation | Offline mutation queue in localStorage |
| Realtime client | `src/lib/shopnest/realtime.ts` | Joins `hh:<householdId>` rooms; invalidates query keys per event |
| Deployment | Sandbox only | **No production deployment performed** |

Data flow for a mutation: `POST/PATCH → zod parse → requireUser/requireHouseholdAccess → Prisma write → logActivity → broadcastHousehold (best-effort, 1.5s timeout) → clients invalidate and refetch`.

---

## 2. Feature inventory

### MVP (working, demo-verified)

| Feature | Status | Notes |
|---|---|---|
| Session auth (register/login/logout/me) | ✅ | 30-day TTL, bcrypt(10), suspension check in `getSessionUser` |
| Households w/ roles OWNER·ADMIN·MEMBER·CAREGIVER | ✅ | Invite codes `SN-XXXXXX` (ambiguous chars excluded), regenerable |
| Shared lists w/ per-item store assignment | ✅ | ACTIVE/COMPLETED/ARCHIVED statuses |
| Stores (household-scoped, user-entered) | ✅ | `verified: false` always — never presented as external listing |
| Household product catalog (Bangla names) | ✅ | Favorites, recurrence, `timesPurchased` on purchase |
| Item photos, comments | ✅ | Base64 in DB, raster-only, 8/item cap |
| Events w/ checklist, activity feed | ✅ | Event types incl. EID/RAMADAN; activity is household-scoped |
| Offline mutation queue | ✅ | localStorage; flush on `online`, socket reconnect, 30s timer, next success |
| Realtime sync (socket.io mini-service) | 🟡 | Works; join rooms are **unauthenticated** at the socket service (hardening item) |
| Admin portal (stats/users/suspend) | ✅ | Real DB metrics; last-admin guard enforced |
| Free/PLUS plan flags | 🟡 | Flags + `POST /plan` → 402 work; **payments disabled** pending approval |
| Demo seed endpoint | ✅ | Rate-limited 5/min/IP, idempotent (`The Demo Family`, creds in route) |

### V2 additions (implemented this phase)

| Feature | Status | Code |
|---|---|---|
| Item prices (`estimatedPriceCents`, `actualPriceCents`, `priceCurrency`) | ✅ | `ShoppingItem`; estimate auto-captured as actual on purchase |
| Shopping Mode sessions (start/finish + snapshot JSON) | ✅ | `ShoppingSession`; finish computes purchased/unavailable/remaining + `spentCents` |
| Item confirmation requests w/ version concurrency | ✅ | `ItemConfirmationRequest`; 409 on stale `version`; statuses PENDING/APPROVED/REJECTED/SUBSTITUTE_SUGGESTED/CANCELLED |
| Budgets (TRIP/WEEKLY/MONTHLY/EVENT) | ✅ | `ShoppingBudget`, integer cents; GET computes spend per scope |
| Price Memory (unit-price normalization) | ✅ | `PriceObservation`; kg/L/pc bases (`money.ts`), stale > 60d, source labels |
| Pantry (IN_STOCK/RUNNING_LOW/OUT_OF_STOCK/UNKNOWN) | ✅ | `PantryItem` |
| Event assignee + event→list dedupe | ✅ | `EventItem.assignedToId`, `shoppingItemId` link makes copy-to-list idempotent |
| Reusable event templates | ✅ | `HouseholdEvent.isTemplate` (+ duplicate-as-template) |
| Notification prefs + large-text accessibility | ✅ | `User.notifyPrefs` JSON, `User.largeText` |
| Catalog aliases (EN/Bangla) + `/api/catalog` search | ✅ | Curated catalog + household products w/ aliases |
| Voice add (client-side parser) | 🟡 | Deterministic regex, Web Speech API, no paid APIs; browser support varies |
| CHIPS partitioned cookie | ✅ | `partitioned: true` on session cookie set/clear |

---

## 3. Store-count root-cause analysis (the P0 fix)

**Symptom.** Store pages and the household "outstanding" view disagreed about how many pending items belonged to a store (observed as a Walmart 7-vs-1 mismatch).

**Root cause.** Two different attribution rules were live at once:

- Stores page `_count` counted items by **`ShoppingItem.storeId` only**.
- The outstanding API grouped items by `item.store ?? item.list.store` — a **fallback to the list's default store**. Items that a user had individually re-assigned (or left unassigned) were counted under the list's store in one view and their own store in the other.

**Fix — one canonical rule**, now documented in `GET /api/households/[id]/outstanding` and enforced everywhere:

1. An item belongs **only** to the store on its own `storeId`. The list's `storeId` is a **default for newly created items only** (`POST /api/lists/[id]/items` inherits it when `storeId` is omitted; explicit `null` = unassigned).
2. No fallback to the list store for attribution, grouping, counting, or filtering — ever.
3. `storeId: null` items group under **"Unassigned"** (`storeId "none"`).
4. Items in **ARCHIVED lists are excluded** from outstanding counts everywhere.
5. The same rule is implemented in: outstanding API, stores API `_count` (`status: 'PENDING', list.status != ARCHIVED`), store detail, and Shopping Mode.
6. Item store-moves broadcast `stores:changed` so store views re-count immediately.

Verified: stores-page counts and outstanding groups now agree for mixed-assignment lists.

---

## 4. Audit findings & fixes (this phase)

| # | Finding | Severity | Fix | Status |
|---|---|---|---|---|
| 1 | Outstanding API used `item.store ?? list.store` fallback → store-count mismatch | P0 | Canonical item-store-only rule (§3) | ✅ |
| 2 | ARCHIVED-list items inflated outstanding counts | P0 | `list.status != 'ARCHIVED'` filter in outstanding + stores counts + session finish | ✅ |
| 3 | Platform admin could demote/suspend the last active admin | P1 | Last-admin guard in `PATCH /api/admin/users/[id]` (409) | ✅ |
| 4 | Household delete did not broadcast → other clients kept stale state | P1 | `broadcastHousehold(household:changed)` before `household.delete` | ✅ |
| 5 | Store duplicate check was case-sensitive | P2 | Case-insensitive compare (trim + lowercase) → 409 | ✅ |
| 6 | Photo validator allowed SVG (XSS vector via `data:image/svg+xml`) and had mismatched size message | P1 | Raster-only whitelist `image/(png|jpe?g|webp|gif)`; message corrected | ✅ |
| 7 | `timesPurchased` incremented at add time (no-op semantics) | P3 | Removed from add path; increments only on purchase transition | ✅ |
| 8 | Missing activity broadcasts (stores CRUD, item store-moves) | P3 | Added `logActivity` + `activity:changed` / `stores:changed` broadcasts | ✅ |

---

## 5. Known remaining gaps (honest)

| Gap | Impact | Mitigation in this build |
|---|---|---|
| **No automated test suite** (no test runner in `package.json`) | Regressions possible | Manual browser + curl verification matrix (see TESTING doc); test plan written as pending work |
| **No native iOS/Android clients** | Mobile = web only | Responsive web UI; PWA not claimed |
| **Payments/billing disabled** | No revenue path live | Plan flags + 402; admin MRR shown as flags-only, honestly labeled |
| **Socket join rooms unauthenticated** | Any connected client can join any `hh:<id>` room and receive change events (ids are opaque cuids; payloads contain no PII beyond item names) | Single-tenant sandbox mitigation; documented hardening item for production |
| **Voice/photo error telemetry absent** | No client-side error metrics | `v2.note` in `/api/admin/stats` states this honestly |
| **Safari lacks CHIPS support** | Session cookie may not persist in a third-party iframe | `Authorization: Bearer` fallback from localStorage covers it **while localStorage is available** |
| Rate limiter is in-memory, per-process | Multi-instance deploys would fragment buckets | Single-instance sandbox; swap documented in `rate-limit.ts` |

---

## 6. Migration strategy

**Expand-only.** V2 introduced new models (`ShoppingSession`, `ItemConfirmationRequest`, `ShoppingBudget`, `PriceObservation`, `PantryItem`) and new nullable/defaulted columns on existing models (`ShoppingItem.estimatedPriceCents/actualPriceCents/priceCurrency`, `HouseholdProduct.aliases`, `HouseholdEvent.isTemplate`, `EventItem.assignedToId/shoppingItemId`, `User.notifyPrefs/largeText`, `HouseholdMember` CAREGIVER role value).

- No destructive operations: no column/type changes, no drops, no renames. Existing MVP data is preserved as-is.
- New columns are nullable or carry defaults, so pre-V2 rows remain valid.
- Schema is applied with `prisma db push` against `db/custom.db`; the DB file itself is the backup/rollback artifact (see DATABASE doc).
- Enum-like fields are validated strings at the API boundary (zod) — SQLite has no native enums, so adding a value is not a migration.

## 7. Verification status

Functional verification is **manual** (browser flows, two-browser realtime tests, curl) — see `SHOPNEST_V2_TESTING.md` for exactly what was exercised and the pending automated plan. No automated tests ship in this build; this is stated in the TESTING and RELEASE docs rather than papered over.
