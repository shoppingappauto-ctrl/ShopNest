# ShopNest V2 — Comprehensive Automated Test Plan

**Scope.** This document is the complete, executable test plan for the ShopNest family-shopping platform (Next.js 16 + TypeScript + Prisma/SQLite + socket.io). It covers unit, API-integration, component, realtime, and end-to-end tests across all 15 required feature areas, plus Row-Level-Security (authorization) isolation tests, CI strategy, and coverage targets. Every test case references **real** endpoints (under `src/app/api/`), **real** helper functions (`requireUser`, `requireHouseholdAccess`, `requireHouseholdManager`, `parseVoiceCommand`, `dollarsToCents`, `computeUnitPriceCents`, `validatePhotoDataUrl`, …), and the **real** data model in `prisma/schema.prisma`.

---

## ⚠️ Sandbox limitation & honesty notice

> **NO tests have been executed in the environment that produced this document.**
>
> The development sandbox that wrote this plan **prohibits writing test code and prohibits executing tests**. Therefore:
> - No `vitest`, `@playwright/test`, `@testing-library/react`, or any test runner is installed in `package.json` today (verified — `devDependencies` contains only `eslint`, `typescript`, `tailwind`, `bun-types`).
> - No `.test.ts`, `.spec.ts`, `.test.tsx`, `__tests__/`, `vitest.config.ts`, or `playwright.config.ts` files exist on disk and **none were created while writing this plan**.
> - Every test case below is labeled **PLANNED — NOT YET EXECUTED**.
>
> This file is a **blueprint**: an engineer working in an **authorized environment** (where installing dev dependencies and running tests is permitted) should be able to copy the framework setup in §1, the directory layout in §2, and the `describe`/`it` outlines in §4–§6, implement the assertions, and run the suite. See §9 (Honesty log) for the explicit execution counters (all zero).

---

## Table of contents

1. Framework & setup
2. Test directory structure
3. Test matrix (15 areas → framework → file → case count → status)
4. Detailed test cases (15 areas)
5. RLS / authorization tests
6. End-to-end (Playwright) scenarios
7. CI strategy
8. Coverage targets
9. Honesty log

---

## 1. Framework & setup

### 1.1 Recommended stack

| Layer | Tool | Why |
|---|---|---|
| Unit (pure functions) | **Vitest** | Native ESM/TS, Bun-compatible, fast watch mode. Targets `src/lib/shopnest/{money,voice,api-helpers,client}.ts`. |
| API integration (route handlers vs scratch SQLite) | **Vitest** + `@vitest/coverage-v8` | Route handlers are exported async functions; we call them directly with `Request` objects against an isolated test DB. No HTTP server needed for most cases. |
| Component | **React Testing Library** (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`) | Drives the React 19 components under `src/components/shopnest/`. |
| End-to-end | **Playwright** | Multi-browser, two-window realtime convergence, offline/network throttling, file/photo upload. |
| DB for API/RLS tests | **Prisma + a scratch SQLite file** (`prisma db push` to `file:./test.db`) | SQLite has **no native RLS**; the API layer (`requireHouseholdAccess`/`requireHouseholdManager`) is the enforcement point. We test the enforcement, not a DB feature. |
| Realtime | **socket.io-client** in Playwright + a real `shopnest-socket` process | The socket service (`mini-services/shopnest-socket/index.ts`) listens on port 3003 (public, via gateway) and 3004 (internal emit). |

### 1.2 Install commands (run in an authorized environment)

```bash
# dev dependencies — NOT installed in the sandbox that wrote this doc
bun add -d vitest @vitest/coverage-v8 \
            @testing-library/react @testing-library/jest-dom @testing-library/user-event \
            jsdom \
            @playwright/test
bunx playwright install --with-deps chromium
```

### 1.3 Example `vitest.config.ts` (documentation — do NOT create on disk in the sandbox)

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/vitest.setup.ts'],
    globals: true,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/api/**/*.test.ts',
      'tests/components/**/*.test.tsx',
      'tests/rls/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/lib/shopnest/**', 'src/app/api/**'],
      exclude: ['**/*.d.ts'],
    },
  },
})
```

### 1.4 Example `tests/vitest.setup.ts` (documentation)

```ts
// tests/vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { db } from '@/lib/db'

// Each API/integration test gets a clean SQLite test DB (see tests/_helpers/db.ts)
beforeEach(async () => {
  await db.$transactionRaw(['DELETE FROM Session;', 'DELETE FROM HouseholdMember;', 'DELETE FROM ShoppingItem;', 'DELETE FROM ShoppingList;', 'DELETE FROM Store;', 'DELETE FROM Household;', 'DELETE FROM User;'])
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

### 1.5 Example `playwright.config.ts` (documentation)

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // realtime tests need deterministic ordering
  workers: 1,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'bun run dev', port: 3000, reuseExistingServer: true, timeout: 60_000 },
    { command: 'bun mini-services/shopnest-socket/index.ts', port: 3003, reuseExistingServer: true, timeout: 30_000 },
  ],
})
```

### 1.6 API integration test helper (documentation)

```ts
// tests/_helpers/api.ts — call Next.js route handlers directly, no HTTP server
import { POST as registerPost } from '@/app/api/auth/register/route'

export function jsonReq(body: unknown, init: RequestInit = {}): Request {
  return new Request('http://test.local/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...init.headers as Record<string,string> },
    body: JSON.stringify(body),
  })
}

// helper to register+login a user and return { user, token }
export async function createUser(name: string, email: string, password = 'testpass123') {
  const res = await registerPost(jsonReq({ name, email, password }))
  return await res.json() // { user, token }
}
```

---

## 2. Test directory structure

```
tests/
├── _helpers/
│   ├── api.ts            # jsonReq, createUser, createHousehold, login helpers
│   ├── db.ts             # scratch SQLite bootstrap, per-test truncation
│   └── realtime.ts       # socket.io-client connection helper
├── vitest.setup.ts
├── unit/
│   ├── money.test.ts
│   ├── voice.test.ts
│   ├── api-helpers.test.ts
│   └── client-offline.test.ts
├── api/
│   ├── auth.test.ts
│   ├── households.test.ts
│   ├── lists.test.ts
│   ├── items.test.ts
│   ├── shopping-sessions.test.ts
│   ├── confirmations.test.ts
│   ├── photos.test.ts
│   ├── budgets.test.ts
│   ├── price-observations.test.ts
│   ├── pantry.test.ts
│   ├── events.test.ts
│   └── admin.test.ts
├── rls/
│   └── cross-household.test.ts        # one 403 assertion per household-scoped route
├── components/
│   ├── shopping-mode.test.tsx
│   ├── add-item-dialog.test.tsx
│   └── sync-status.test.tsx
└── e2e/
    ├── golden-shopping.spec.ts
    ├── photo-confirmation.spec.ts
    └── offline-sync.spec.ts
```

---

## 3. Test matrix

Every row is **PLANNED — NOT YET EXECUTED**. "Cases" = number of `it()` blocks outlined in §4 (and §5/§6 where noted).

| # | Area | Framework | File | Cases | Status |
|---|---|---|---|---|---|
| 1 | Authentication & sessions | Vitest (API + unit) | `tests/api/auth.test.ts` | 20 | PLANNED |
| 2 | Household invitations & permissions | Vitest (API) | `tests/api/households.test.ts` | 22 | PLANNED |
| 3 | Shopping list creation & editing | Vitest (API) | `tests/api/lists.test.ts` | 18 | PLANNED |
| 4 | Real-time synchronization | Playwright + Vitest | `tests/e2e/realtime.spec.ts` (+ unit) | 12 | PLANNED |
| 5 | Multi-store item counts (P0) | Vitest (API) | `tests/api/store-counts.test.ts` | 11 | PLANNED |
| 6 | Shopping Mode | Vitest (API) | `tests/api/shopping-sessions.test.ts` | 12 | PLANNED |
| 7 | Photo confirmations | Vitest (API + unit) | `tests/api/confirmations.test.ts`, `tests/api/photos.test.ts`, `tests/unit/api-helpers.test.ts` | 17 | PLANNED |
| 8 | Substitutions | Vitest (API) | `tests/api/items.test.ts` (substitutions block) | 7 | PLANNED |
| 9 | Shopping budgets | Vitest (API) | `tests/api/budgets.test.ts` | 11 | PLANNED |
| 10 | Price calculations | Vitest (unit + API) | `tests/unit/money.test.ts`, `tests/api/price-observations.test.ts` | 16 | PLANNED |
| 11 | Pantry | Vitest (API) | `tests/api/pantry.test.ts` | 9 | PLANNED |
| 12 | Voice-input parsing | Vitest (unit) | `tests/unit/voice.test.ts` | 16 | PLANNED |
| 13 | Event planning | Vitest (API) | `tests/api/events.test.ts` | 14 | PLANNED |
| 14 | Offline synchronization | Vitest (unit, jsdom) | `tests/unit/client-offline.test.ts` | 13 | PLANNED |
| 15 | Account deletion | Vitest (API) — **GAP endpoint** | `tests/api/account-deletion.test.ts` | 10 | PLANNED (endpoint missing) |
| — | RLS / cross-household isolation | Vitest (API) | `tests/rls/cross-household.test.ts` | 12 | PLANNED |
| — | E2E golden paths | Playwright | `tests/e2e/*.spec.ts` | 5 scenarios | PLANNED |

**Total outlined `it()` test cases: 225** (210 in the 15 feature areas + 12 RLS + 5 E2E scenarios — counted from the actual `it()` blocks in §4–§6). Every case is PLANNED — NOT YET EXECUTED.

*Note: the pure-function `money.ts` and `api-helpers.ts` (`validatePhotoDataUrl`) unit cases are folded into area #10 and #7 respectively, not double-counted above.*

---

## 4. Detailed test cases

> Conventions: every block is a copy-paste-ready skeleton. Comments describe the assertions in prose. Helper names (`requireUser`, `requireHouseholdAccess`, `requireHouseholdManager`, `jsonError`, `parseVoiceCommand`, `dollarsToCents`, `computeUnitPriceCents`, `validatePhotoDataUrl`, `broadcastHousehold`) are the real exports from `src/lib/shopnest/*.ts`.

### 4.1 Authentication & sessions  *(20 cases — PLANNED)*

Grounded in: `src/app/api/auth/{register,login,logout,refresh,me}/route.ts`, `src/lib/shopnest/auth.ts` (`createSession`, `refreshSessionIfNeeded`, `destroySession`, `getSessionUser`, `setSessionCookie`, `SESSION_COOKIE='sn_session'`, TTL 30 days, refresh window 7 days).

```ts
// tests/api/auth.test.ts
import { describe, it, expect } from 'vitest'
import { POST as registerPost } from '@/app/api/auth/register/route'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { POST as refreshPost } from '@/app/api/auth/refresh/route'
import { GET as meGet } from '@/app/api/auth/me/route'
import { db } from '@/lib/db'
import { jsonReq } from '../_helpers/api'

describe('auth: register', () => {
  it('first real registrant becomes platform admin (isAdmin=true) — PLANNED', async () => {
    // POST /api/auth/register with {name,email,password}; assert 201, body.user.isAdmin===true
    // (no adminExists yet → isFirstUser path in register/route.ts)
  })

  it('second registrant is NOT an admin — PLANNED', async () => {
    // after a first admin exists, a new registration → isAdmin===false
  })

  it('duplicate email → 409 "An account with this email already exists." — PLANNED', async () => {
    // register twice with same email; second returns 409
  })

  it('short password (<8) → 400 with zod message — PLANNED', async () => {
    // password "short" → parseBody throws → jsonError → 400, message mentions 8 characters
  })

  it('invalid email → 400 — PLANNED', async () => {
    // email "not-an-email" → 400
  })

  it('successful register sets sn_session cookie with HttpOnly; SameSite=Lax; Secure — PLANNED', async () => {
    // inspect Set-Cookie header on the Response; assert attributes present.
    // (In direct-handler tests, verify the cookie write via the cookies() mock or
    //  via an in-process Next server in tests/_helpers.)
  })

  it('response body includes a usable token (Bearer fallback for iframe) — PLANNED', async () => {
    // body.token is a non-empty string matching /^[a-f0-9-]{36,}$/
  })
})

describe('auth: login', () => {
  it('correct credentials → 200, returns { user, token } — PLANNED', async () => {
    // pre-seed user via register; login → 200, token present, user.email matches
  })

  it('wrong password → 401 "Incorrect email or password." — PLANNED', async () => {
    // no user enumeration: unknown-email and wrong-password both yield 401 + same message
  })

  it('suspended user (isSuspended=true) → 403 — PLANNED', async () => {
    // flip isSuspended on the User row; login → 403 "…has been suspended."
  })

  it('Bearer header fallback authenticates when no cookie present — PLANNED', async () => {
    // GET /api/auth/me with Authorization: Bearer <token> (no cookie) → 200 user object
  })
})

describe('auth: me + refresh', () => {
  it('GET /api/auth/me without auth → 200 with { user: null, households: [] } — PLANNED', async () => {
    // note: /me returns 200 (not 401) when unauthenticated; it returns null user
  })

  it('GET /api/auth/me with valid session → 200 with user + memberships array — PLANNED', async () => {
    // assert households[] includes role + inviteCode fields
  })

  it('POST /api/auth/refresh extends TTL when within 7-day window — PLANNED', async () => {
    // create a session row with expiresAt = now+5d; call refresh → refreshed===true,
    // new expiresAt ≈ now+30d; DB row updated
  })

  it('POST /api/auth/refresh is a no-op when TTL is far from expiry — PLANNED', async () => {
    // session expiresAt = now+20d; refresh → refreshed===false, expiresAt unchanged
  })

  it('POST /api/auth/refresh with expired session → 401 — PLANNED', async () => {
    // session.expiresAt = now-1d; refresh throws ApiError(401)
  })

  it('expired session row is rejected by getSessionUser (returns null) — PLANNED', async () => {
    // GET /api/auth/me with an expired session token → { user: null, households: [] }
  })
})

describe('auth: logout', () => {
  it('POST /api/auth/logout deletes the Session row — PLANNED', async () => {
    // seed session; logout → 200; assert db.session.count === 0 for that token
  })

  it('after logout, the same token no longer authenticates (Bearer rejected) — PLANNED', async () => {
    // GET /api/auth/me with the old token → user: null
  })

  it('logout clears the sn_session cookie (maxAge=0) — PLANNED', async () => {
    // inspect Set-Cookie: sn_session=""; Max-Age=0
  })
})
```

### 4.2 Household invitations & permissions  *(22 cases — PLANNED)*

Grounded in: `src/app/api/households/route.ts` (create/GET), `households/join/route.ts`, `households/[id]/invite/route.ts` (rotate code), `households/[id]/leave/route.ts`, `households/[id]/members/[memberId]/route.ts` (PATCH role, DELETE member), `households/[id]/route.ts` (DELETE household owner-only), `auth.ts` (`requireHouseholdAccess` 403, `requireHouseholdManager` 403, `generateInviteCode`).

```ts
// tests/api/households.test.ts
describe('households: create + invite codes', () => {
  it('POST /api/households → 201, creator becomes OWNER, inviteCode matches /^SN-[A-Z0-9]{6}$/ — PLANNED')
  it('GET /api/households (authenticated) returns the caller\'s memberships with role — PLANNED')
  it('GET /api/households without auth → 401 — PLANNED')
  it('POST /api/households/[id]/invite rotates the code (manager-only) — PLANNED')
  it('POST /api/households/[id]/invite as MEMBER → 403 — PLANNED') // requireHouseholdManager
  it('rotated invite code is unique vs existing households — PLANNED')
})

describe('households: join via code', () => {
  it('POST /api/households/join with valid SN-XXXXXX code → 200, new MEMBER row — PLANNED')
  it('join with malformed code → 400 (regex /^SN-[A-Z0-9]{6}$/) — PLANNED')
  it('join with unknown code → 404 "That invite code is not valid." — PLANNED')
  it('re-join as existing member → 409 "You are already a member…" — PLANNED')
  it('join a household at capacity (>=20 members) → 403 "This household is full." — PLANNED')
  it('joining is case-insensitive (code uppercased by zod transform) — PLANNED')
})

describe('households: role enforcement', () => {
  it('requireHouseholdAccess: non-member calling any /households/[id]/* route → 403 — PLANNED')
  it('requireHouseholdManager: MEMBER/CAREGIVER calling /invite or /members PATCH → 403 — PLANNED')
  it('OWNER role cannot be changed (PATCH /members/[memberId] on OWNER → 403) — PLANNED')
  it('OWNER cannot be removed (DELETE /members/[memberId] on OWNER → 403) — PLANNED')
  it('ADMIN cannot remove themselves (must use Leave) → 403 — PLANNED')
  it('PATCH /members/[memberId] only accepts ADMIN|MEMBER enum (CAREGIVER not settable here) — PLANNED')
})

describe('households: leave + delete', () => {
  it('OWNER leaving a household with other members but no other owner → 403 "Promote another member…" — PLANNED')
  it('OWNER leaving as sole member → 200 (household left with the owner) — PLANNED')
  it('DELETE /api/households/[id] as non-OWNER → 403 — PLANNED')
  it('DELETE /api/households/[id] as OWNER → 200, household + cascaded rows removed — PLANNED')
})
```

### 4.3 Shopping list creation & editing  *(18 cases — PLANNED)*

Grounded in: `src/app/api/households/[id]/lists/route.ts` (GET/POST, groupBy counts), `src/app/api/lists/[id]/route.ts` (GET/PATCH/DELETE, status enum `ACTIVE|COMPLETED|ARCHIVED`), `src/app/api/lists/[id]/items/route.ts` (POST item, storeId inheritance semantics), `src/app/api/items/[id]/route.ts` (PATCH/DELETE item, status transitions).

```ts
// tests/api/lists.test.ts
describe('lists: create + read', () => {
  it('POST /api/households/[id]/lists → 201, createdById = caller, storeId resolved — PLANNED')
  it('POST with storeId not in household → 404 "Store not found in this household." — PLANNED')
  it('GET /api/households/[id]/lists excludes ARCHIVED lists (status <> ARCHIVED) — PLANNED')
  it('GET returns per-list counts { total, pending, purchased, unavailable } — PLANNED')
  it('non-member GET → 403 — PLANNED')
})

describe('lists: edit + lifecycle', () => {
  it('PATCH /api/lists/[id] updates name/emoji/storeId — PLANNED')
  it('PATCH sets status ARCHIVED → list hidden from GET lists — PLANNED')
  it('PATCH sets status COMPLETED → still visible (not archived) — PLANNED')
  it('DELETE /api/lists/[id] cascades items (Prisma onDelete: Cascade) — PLANNED')
  it('PATCH/DELETE by non-member → 403 (requireHouseholdAccess) — PLANNED')
})

describe('items: add + transitions', () => {
  it('POST item with explicit storeId → item.storeId = that store — PLANNED')
  it('POST item with storeId=null → item.storeId null (Unassigned), NOT list default — PLANNED')
  it('POST item with storeId omitted → inherits list.storeId as default — PLANNED')
  it('PATCH /api/items/[id] status PENDING→PURCHASED sets purchasedAt + purchasedById, captures actualPriceCents — PLANNED')
  it('PATCH status PURCHASED→PENDING clears purchasedAt + purchasedById — PLANNED')
  it('PATCH favoriteProductId purchase increments HouseholdProduct.timesPurchased exactly once — PLANNED')
  it('DELETE item → 200, gone from list GET — PLANNED')
  it('moving an item between stores broadcasts stores:changed — PLANNED') // verify via spy on broadcastHousehold
```

*(The items `describe` block above contributes 8 of this file's 18 `it()` cases; the create+read and edit+lifecycle blocks contribute the remaining 10.)*

### 4.4 Real-time synchronization  *(12 cases — PLANNED)*

Grounded in: `mini-services/shopnest-socket/index.ts` (port 3003 public via gateway, path `/`, room `hh:<id>`, internal emit API on port 3004 `/internal/emit`), `src/lib/shopnest/notify.ts` (`broadcastHousehold` POSTs to `http://127.0.0.1:3004/internal/emit` with `{room,event,payload}`), event names: `lists:changed`, `items:changed`, `stores:changed`, `products:changed`, `events:changed`, `activity:changed`, `household:changed`.

```ts
// tests/e2e/realtime.spec.ts (Playwright) + tests/api/notify.unit.test.ts (Vitest)
describe('realtime: socket service', () => {
  it('GET http://127.0.0.1:3004/health → 200 { ok, service:"shopnest-socket", clients } — PLANNED')
  it('POST /internal/emit without room → 400 — PLANNED')
  it('POST /internal/emit with room+event delivers to sockets in that room — PLANNED')
  it('join caps at 50 householdIds per join event — PLANNED') // ids.slice(0,50)
  it('client socket joins room hh:<id> and receives items:changed after a mutation — PLANNED')
})

describe('realtime: broadcast on mutation', () => {
  it('POST /api/households/[id]/lists broadcasts lists:changed to the household room — PLANNED')
  it('POST /api/lists/[id]/items broadcasts items:changed + stores:changed + activity:changed — PLANNED')
  it('POST /api/households/[id] (create) broadcasts household:changed — PLANNED')
  it('DELETE /api/households/[id] broadcasts household:changed BEFORE deletion (so clients drop state) — PLANNED')
})

describe('realtime: convergence + reconnection', () => {
  it('two browsers in the same household converge on an item add without manual refresh — PLANNED') // Playwright two contexts
  it('socket disconnect → 30s/focus refetch still converges (best-effort delivery) — PLANNED')
  it('reconnect re-joins all household rooms — PLANNED')
})
```

### 4.5 Multi-store item counts (P0 regression lock)  *(11 cases — PLANNED)*

Grounded in: `src/app/api/households/[id]/outstanding/route.ts` (canonical: item.storeId only; `status:'PENDING'`, `list.status <> 'ARCHIVED'`; Unassigned group for null storeId) and `src/app/api/households/[id]/stores/route.ts` (`_count.items` filtered identically: `status:'PENDING', list.status <> 'ARCHIVED'`). This is the **P0 regression** called out in the existing doc: items must NEVER be counted under the list's default store.

```ts
// tests/api/store-counts.test.ts
describe('canonical store attribution (P0)', () => {
  it('item appears under exactly one store (its own storeId) in outstanding groups — PLANNED')
  it('list default store does NOT absorb items that have their own storeId — PLANNED')
  it('item with storeId=null groups under "Unassigned" — PLANNED')
  it('PENDING items in ARCHIVED lists are excluded from outstanding groups — PLANNED')
  it('PURCHASED/UNAVAILABLE items excluded from outstanding groups — PLANNED')
  it('stores page _count.items === outstanding group length, store-by-store — PLANNED')
  it('moving an item between stores updates both stores\' counts immediately — PLANNED')
  it('assigning a store to a previously-unassigned item removes it from Unassigned — PLANNED')
  it('clearing an item\'s store (storeId=null) moves it to Unassigned — PLANNED')
  it('archiving a list drops its items from every store count — PLANNED')
  it('un-archiving a list re-adds its PENDING items to store counts — PLANNED')
})
```

### 4.6 Shopping Mode  *(12 cases — PLANNED)*

Grounded in: `src/app/api/households/[id]/shopping-sessions/route.ts` (POST start: optional listId/storeId, auto-closes stale ACTIVE sessions), `src/app/api/shopping-sessions/[id]/route.ts` (GET one; PATCH finish: computes `purchasedCount`/`unavailableCount`/`remainingCount`/`spentCents` from `actualPriceCents ?? estimatedPriceCents`, `snapshotJson`, excludes `list.status = ARCHIVED`, double-finish → 409).

```ts
// tests/api/shopping-sessions.test.ts
describe('shopping mode: start', () => {
  it('POST /api/households/[id]/shopping-sessions → 201 ACTIVE session, startedById = caller — PLANNED')
  it('store-scoped session records storeId; list-scoped records listId — PLANNED')
  it('starting a session auto-closes any prior ACTIVE session in the household — PLANNED')
  it('start with storeId not in household → 404 — PLANNED')
  it('start with listId not in household → 404 — PLANNED')
})

describe('shopping mode: finish', () => {
  it('PATCH finish computes purchasedCount from items PURCHASED since session.startedAt — PLANNED')
  it('unavailableCount counts status=UNAVAILABLE; remainingCount counts PENDING — PLANNED')
  it('spentCents = sum(actualPriceCents ?? estimatedPriceCents ?? 0) of purchased items — PLANNED')
  it('snapshotJson contains purchased/unavailable/remaining arrays with name + priceCents — PLANNED')
  it('finish excludes items whose LIST is ARCHIVED (status <> ARCHIVED filter) — PLANNED')
  it('double-finish (already FINISHED) → 409 "This session is already finished." — PLANNED')
  it('finish by a non-member → 403 (requireHouseholdAccess) — PLANNED')
})
```

### 4.7 Photo confirmations  *(17 cases — PLANNED)*

Grounded in: `src/app/api/items/[id]/photos/route.ts` (POST, 8-photo cap, `validatePhotoDataUrl`), `src/app/api/items/[id]/confirmations/route.ts` (POST creates PENDING, one-open-per-item 409; GET list), `src/app/api/confirmations/[id]/route.ts` (PATCH decide/cancel, optimistic `version`, decided → 409), `src/lib/shopnest/api-helpers.ts` (`validatePhotoDataUrl`: regex `^data:image/(png|jpe?g|webp|gif);base64,`, max 700_000 bytes).

```ts
// tests/unit/api-helpers.test.ts
describe('validatePhotoDataUrl (pure)', () => {
  it('accepts PNG, JPEG, WebP, GIF data URLs — PLANNED')
  it('rejects SVG (data:image/svg+xml) with "…PNG, JPEG, WebP or GIF…" — PLANNED')
  it('rejects oversized (>700_000 chars) with "…too large…" — PLANNED')
  it('rejects non-data-url strings — PLANNED')
})

// tests/api/photos.test.ts
describe('photos: upload', () => {
  it('POST /api/items/[id]/photos with valid base64 PNG → 201, photo row created — PLANNED')
  it('SVG photo → 400 with the raster-only message — PLANNED')
  it('9th photo on an item that already has 8 → 403 "…already has 8 photos…" — PLANNED')
  it('DELETE /api/items/[id]/photos?photoId=… removes the photo — PLANNED')
  it('photo from another household\'s item → 404 (requireHouseholdAccess) — PLANNED')
})

// tests/api/confirmations.test.ts
describe('confirmations: lifecycle', () => {
  it('POST /api/items/[id]/confirmations → 201 PENDING, version=1 — PLANNED')
  it('second open request on the same item → 409 "…already has a pending…" — PLANNED')
  it('PATCH decide APPROVED with correct version → status APPROVED, version=2 — PLANNED')
  it('PATCH decide with stale version → 409 "…just updated by someone else…" — PLANNED')
  it('re-deciding an already-decided request → 409 "…already decided." — PLANNED')
  it('cancel by the requester (PENDING) → status CANCELLED — PLANNED')
  it('cancel by a non-requester → 403 "Only the shopper who asked can cancel…" — PLANNED')
  it('SUBSTITUTE_SUGGESTED decision records substituteName — PLANNED')
})
```

### 4.8 Substitutions  *(7 cases — PLANNED)*

Grounded in: `src/app/api/items/[id]/route.ts` PATCH (status enum includes `SUBSTITUTED`, `substitutedWith` field, activity log "substituted … with …"), `src/app/api/confirmations/[id]/route.ts` (`SUBSTITUTE_SUGGESTED` + `substituteName`), `ShoppingItem.substitutedWith` column.

```ts
// tests/api/items.test.ts → substitutions block
describe('substitutions', () => {
  it('PATCH item status=SUBSTITUTED with substitutedWith="Oat milk" persists both — PLANNED')
  it('substitutedWith=null + status=SUBSTITUTED is allowed (no substitute name) — PLANNED')
  it('transition PENDING→SUBSTITUTED logs ITEM_STATUS activity "substituted … with …" — PLANNED')
  it('PATCH with status=SUBSTITUTED but invalid substitutedWith (>80 chars) → 400 — PLANNED')
  it('confirmation SUBSTITUTE_SUGGESTED sets substituteName; item can later be PATCHed SUBSTITUTED — PLANNED')
  it('revert SUBSTITUTED→PENDING clears substitutedWith? (assert current behavior) — PLANNED')
  it('substituted item is excluded from outstanding PENDING counts — PLANNED')
})
```

### 4.9 Shopping budgets  *(11 cases — PLANNED)*

Grounded in: `src/app/api/households/[id]/budgets/route.ts` (GET computes `spendCents`; POST upsert-by-target; scopes `TRIP|WEEKLY|MONTHLY|EVENT`; `amountCents` integer minor units; TRIP requires listId, EVENT requires eventId), `ShoppingBudget` model.

```ts
// tests/api/budgets.test.ts
describe('budgets: create + scopes', () => {
  it('POST TRIP with listId → 201; amountCents stored as integer — PLANNED')
  it('POST TRIP without listId → 400 "A list is required for a trip budget." — PLANNED')
  it('POST EVENT without eventId → 400 — PLANNED')
  it('POST WEEKLY/MONTHLY with periodStart → 201 — PLANNED')
  it('upsert-by-target: second POST for same TRIP/listId replaces amount — PLANNED')
  it('amountCents must be integer minor units (zod int, 0..100_000_000) — PLANNED')
})

describe('budgets: spend computation', () => {
  it('TRIP spend = sum(actualPriceCents ?? estimatedPriceCents) of PURCHASED items in that list — PLANNED')
  it('EVENT spend = sum over items linked via EventItem.shoppingItemId — PLANNED')
  it('WEEKLY spend = purchased items with purchasedAt >= max(periodStart, now-7d) — PLANNED')
  it('MONTHLY spend = purchased items with purchasedAt >= first of current month — PLANNED')
  it('cross-household isolation: household B\'s purchases never counted in A\'s budget — PLANNED') // RLS-adjacent
})
```

### 4.10 Price calculations  *(16 cases — PLANNED)*

Grounded in: `src/lib/shopnest/money.ts` (`dollarsToCents`, `formatCents`, `normalizeUnit`, `computeUnitPriceCents`, `isPriceStale`, `PRICE_STALE_DAYS=60`) and `src/app/api/households/[id]/price-observations/route.ts` (POST computes `unitPriceCents`/`unitPriceBasis` at write time; GET groups by product, latest + lowest per store, stale flag).

```ts
// tests/unit/money.test.ts
describe('dollarsToCents (decimal-safe)', () => {
  it('"3.48" → 348; "$3.48" → 348; "3.5" → 350 — PLANNED')
  it('"" / null / undefined → null — PLANNED')
  it('"1.005" rounds to 100 (truncates to 2 frac digits via slice) — PLANNED') // document current rounding behavior
  it('negative / NaN-like input → null (regex rejects) — PLANNED')
  it('commas stripped: "1,000.00" → 100000 — PLANNED')
})

describe('computeUnitPriceCents', () => {
  it('$3.48 / 1 gal → unitPriceCents ≈ 92 per L (factor 3.78541) — PLANNED')
  it('5 kg × $10 → 200 cents/kg — PLANNED')
  it('dozen × $6 → 50 cents/pc — PLANNED')
  it('unknown unit falls back to pc basis factor 1 — PLANNED')
  it('zero/negative total or quantity → null — PLANNED')
})

describe('isPriceStale', () => {
  it('observed 60 days + 1 second ago → stale=true — PLANNED')
  it('observed 59 days ago → stale=false — PLANNED')
  it('accepts ISO string or Date — PLANNED')
})

describe('price-observations API', () => {
  it('POST writes unitPriceCents + unitPriceBasis computed from money.computeUnitPriceCents — PLANNED')
  it('GET groups by normalized product name; per-store latest + lowestTotalPriceCents — PLANNED')
  it('stale observations flagged stale=true in GET response — PLANNED')
})
```

### 4.11 Pantry  *(9 cases — PLANNED)*

Grounded in: `src/app/api/households/[id]/pantry/route.ts` (GET/POST, status enum `IN_STOCK|RUNNING_LOW|OUT_OF_STOCK|UNKNOWN`), `src/app/api/households/[id]/pantry/[pantryId]/route.ts` (PATCH/DELETE, household-scoped find).

```ts
// tests/api/pantry.test.ts
describe('pantry', () => {
  it('POST /api/households/[id]/pantry → 201, status defaults to UNKNOWN — PLANNED')
  it('GET lists pantry items household-scoped, ordered by status then name — PLANNED')
  it('PATCH status IN_STOCK→RUNNING_LOW→OUT_OF_STOCK→UNKNOWN round-trips — PLANNED')
  it('PATCH with invalid status enum → 400 — PLANNED')
  it('householdProductId not in household → 404 — PLANNED')
  it('DELETE removes the pantry item — PLANNED')
  it('non-member GET/PATCH/DELETE → 403 — PLANNED')
  it('pantry item from household B not visible to household A member — PLANNED') // RLS
  it('PATCH on pantryId from a different household → 404 (findFirst by householdId) — PLANNED')
})
```

### 4.12 Voice-input parsing  *(16 cases — PLANNED)*

Grounded in: `src/lib/shopnest/voice.ts` (`parseVoiceCommand`, `NUMBER_WORDS` incl. Bangla `এক..দশ`, `UNIT_ALIASES` incl. `কেজি`/`গ্রাম`/`ডজন`, Bangla digit normalization `০-৯`, store tail regex `\b(?:to|from|at)\s+…$`, confidence rule `high` ⟺ sawQuantity && sawUnit).

```ts
// tests/unit/voice.test.ts
import { parseVoiceCommand } from '@/lib/shopnest/voice'

describe('parseVoiceCommand', () => {
  it('"add two gallons of milk to Walmart" → { name:"Milk", quantity:2, unit:"gal", storeName:"Walmart", confidence:"high" } — PLANNED')
  it('"add 5 kilos of basmati rice to Bangla Bazar" → { name:"Basmati rice", qty:5, unit:"kg", storeName:"Bangla Bazar", high } — PLANNED')
  it('Bangla digits: "৫ কেজি চাল" → quantity 5, unit "kg" — PLANNED')
  it('Bangla unit word "গ্রাম" → unit "g" — PLANNED')
  it('Bangla number word "দুই" → quantity 2 — PLANNED')
  it('"milk" alone → { name:"Milk", qty:1, unit:"pc", storeName:null, confidence:"medium" } — PLANNED')
  it('"2 kg rice" (no store, no "add") → { name:"rice", qty:2, unit:"kg", storeName:null, high } — PLANNED')
  it('unit word not mistaken for store tail ("2 gallons of milk to gal" treats "gal" as unit, not store) — PLANNED')
  it('trailing "name N unit" form: "milk 2 liters" → qty 2, unit "L" — PLANNED')
  it('"please buy 3 packs of diapers" → strips "please buy" prefix — PLANNED')
  it('"...to the shopping list" suffix stripped — PLANNED')
  it('empty/whitespace input → null — PLANNED')
  it('name-only "ab" (length<=2) → confidence "low" — PLANNED')
  it('"a dozen eggs" → quantity 12, unit "dozen" (NUMBER_WORDS dozen=12) — PLANNED')
  it('store name Title-cased ("walmart" → "Walmart") — PLANNED')
  it('quantity-only (no unit) → confidence "medium" — PLANNED')
})
```

### 4.13 Event planning  *(14 cases — PLANNED)*

Grounded in: `src/app/api/households/[id]/events/route.ts` (GET/POST), `src/app/api/events/[id]/route.ts` (PATCH/DELETE), `src/app/api/events/[id]/items/route.ts` (POST checklist item), `src/app/api/event-items/[id]/route.ts` (PATCH assignee/store, DELETE), `src/app/api/events/[id]/copy-to-list/route.ts` (idempotent via `EventItem.shoppingItemId`), `src/app/api/events/[id]/duplicate/route.ts` (`asTemplate` → `isTemplate=true`, copies items but NOT `shoppingItemId`).

```ts
// tests/api/events.test.ts
describe('events: create + edit', () => {
  it('POST /api/households/[id]/events → 201, status PLANNING, isTemplate=false — PLANNED')
  it('PATCH event name/type/date/guestCount/budget/notes — PLANNED')
  it('POST event item with storeId not in household → 404 — PLANNED')
  it('PATCH /api/event-items/[id] assignedToId must be a household member → else 404 — PLANNED')
  it('DELETE event cascades its EventItems — PLANNED')
  it('non-member PATCH/DELETE → 403 — PLANNED')
})

describe('events: copy-to-list (idempotent)', () => {
  it('POST /api/events/[id]/copy-to-list creates one ShoppingItem per unlinked EventItem — PLANNED')
  it('response { copied, skipped } counts correct on first run — PLANNED')
  it('re-run copies 0, skipped = total (EventItem.shoppingItemId now set) — PLANNED') // duplicate-prevention lock
  it('copied items carry storeId from the EventItem — PLANNED')
  it('copy-to-list with listId from another household → 404 — PLANNED')
})

describe('events: duplicate + template', () => {
  it('POST /api/events/[id]/duplicate (asTemplate=false) → new event named "<name> (copy)", isTemplate=false — PLANNED')
  it('POST duplicate asTemplate=true → isTemplate=true, name "<name> (template)" — PLANNED')
  it('duplicate copies items (name/qty/unit/category/storeId/assignedToId) but NOT shoppingItemId — PLANNED')
})
```

### 4.14 Offline synchronization  *(13 cases — PLANNED)*

Grounded in: `src/lib/shopnest/client.ts` (`api()`, `enqueue`, `flushQueue`, `getQueue`/`setQueue` via `localStorage` key `shopnest_pending_queue`, `OfflineQueuedError`, `ApiClientError`, queue flush rules: `res.ok || (status 400-499 && !==408)` removes from queue; transient 5xx/408/network → keep & stop; `noOfflineQueue` opt-out; `navigator.onLine` gate).

```ts
// tests/unit/client-offline.test.ts
import { api, getQueue, flushQueue, OfflineQueuedError, ApiClientError } from '@/lib/shopnest/client'

describe('offline queue: enqueue', () => {
  it('mutation while navigator.onLine=false throws OfflineQueuedError and enqueues to localStorage — PLANNED')
  it('GET never enqueues (only POST/PATCH/DELETE) — PLANNED')
  it('noOfflineQueue:true mutation never enqueues (used for auth) — PLANNED')
  it('queued mutation has id/createdAt/method/url/body/label — PLANNED')
})

describe('offline queue: flush rules', () => {
  it('2xx response removes the mutation from the queue — PLANNED')
  it('4xx (except 408) removes the mutation (permanently rejected) — PLANNED')
  it('5xx keeps the mutation in the queue and stops flushing — PLANNED')
  it('408 keeps the mutation in the queue — PLANNED')
  it('network error during flush keeps the mutation and stops — PLANNED')
  it('flushQueue is a no-op while navigator.onLine=false — PLANNED')
  it('successful mutation triggers flushQueue of any pending items — PLANNED')
})

describe('offline queue: no false "synced"', () => {
  it('a queued mutation is NOT presented as synchronized until 2xx replay — PLANNED') // cache invalidation only after res.ok
  it('OfflineQueuedError carries the user-facing "Saved offline…" message — PLANNED')
})
```

### 4.15 Account deletion  *(10 cases — PLANNED — endpoint is a GAP)*

**GAP discovered while grounding this plan.** The UI calls `useDeleteAccount()` in `src/lib/shopnest/hooks.ts`, which issues:

```ts
api('/api/auth/register', { method: 'DELETE', noOfflineQueue: true })
```

But `src/app/api/auth/register/route.ts` only exports `POST` (no `DELETE` handler). Calling `DELETE /api/auth/register` therefore returns **405 Method Not Allowed** today. **The account-deletion endpoint does not exist.** The tests below target the **to-be-implemented** endpoint (recommended `DELETE /api/auth/account`) and assert the required cascade.

```ts
// tests/api/account-deletion.test.ts
describe('account deletion — GAP: endpoint missing', () => {
  it('CURRENT: DELETE /api/auth/register → 405 (no DELETE handler exported) — PLANNED') // documents the gap
  it('DELETE /api/auth/account (to be implemented) → 200 { ok:true } — PLANNED')
  it('after deletion, all Session rows for the user are removed — PLANNED') // cascade: Session.onDelete:Cascade on User
  it('after deletion, all HouseholdMember rows for the user are removed — PLANNED') // cascade: HouseholdMember.onDelete:Cascade
  it('items added by the user (addedById) are removed — PLANNED') // ShoppingItem.addedBy onDelete:Cascade
  it('items purchasedBy the user (purchasedById) are nullified, NOT removed — PLANNED') // onDelete:SetNull (preserve history)
  it('ItemPhoto rows uploadedById = user are removed — PLANNED') // cascade
  it('PriceObservation.observedById = user are removed — PLANNED') // cascade
  it('confirmation requests requestedBy are removed; decidedBy nullified — PLANNED') // mixed cascade/SetNull
  it('cross-household data is not orphaned: deleting user A leaves household B fully intact — PLANNED')
})
```

**Required implementation spec for the gap (for the engineer):**
- Add `export async function DELETE()` to `src/app/api/auth/register/route.ts` **or** a new `src/app/api/auth/account/route.ts` (preferred — cleaner URL). Re-point `useDeleteAccount` in `src/lib/shopnest/hooks.ts` to the new URL.
- The handler must: `requireUser()` → confirm password (re-auth) → `db.user.delete({ where: { id } })` and rely on Prisma's declared `onDelete` cascades (Session/Cascade, HouseholdMember/Cascade, ShoppingItem.addedBy/Cascade, ItemPhoto/Cascade, PriceObservation/Cascade, ConfirmationRequest.requestedBy/Cascade; SetNull for ShoppingItem.purchasedBy, ConfirmationRequest.decidedBy, EventItem.assignedTo, Activity.userId).
- **OWNER protection:** if the user is the sole OWNER of any household with remaining members, the endpoint must either 409 ("promote another owner first") or reassign ownership — pick one and document it. (Mirrors the `/households/[id]/leave` guard.)
- Destroy the current session and clear the cookie.
- Broadcast `household:changed` to every household the user was a member of (so other clients drop stale state).

---

## 5. RLS / authorization tests  *(12 cases — PLANNED)*

**SQLite reality:** SQLite has **no native Row-Level-Security** (unlike Postgres). ShopNest therefore enforces isolation entirely in the **API layer** via `requireHouseholdAccess(userId, householdId)` (throws `ApiError(403)` on non-membership) and `requireHouseholdManager` (throws 403 for MEMBER/CAREGIVER). Every household-scoped route calls one of these. The tests below assert that a user from household **A** receives **403** (or 404 where the route hides existence) when targeting household **B**'s resources.

```ts
// tests/rls/cross-household.test.ts
describe('cross-household isolation (API-layer RLS)', () => {
  // Setup: userA in householdA, userB in householdB (no shared membership)

  it('GET /api/households/[B]/lists as userA → 403 — PLANNED')
  it('POST /api/households/[B]/lists as userA → 403 — PLANNED')
  it('GET /api/households/[B]/stores as userA → 403 — PLANNED')
  it('GET /api/households/[B]/outstanding as userA → 403 — PLANNED')
  it('GET /api/households/[B]/budgets as userA → 403 — PLANNED')
  it('GET /api/households/[B]/pantry as userA → 403 — PLANNED')
  it('GET /api/households/[B]/events as userA → 403 — PLANNED')
  it('GET /api/households/[B]/shopping-sessions as userA → 403 — PLANNED')
  it('GET /api/households/[B]/price-observations as userA → 403 — PLANNED')
  it('GET /api/lists/[listFromB] as userA → 403 (requireHouseholdAccess on list.householdId) — PLANNED')
  it('PATCH /api/items/[itemFromB] as userA → 403 — PLANNED')
  it('GET /api/items/[itemFromB]/confirmations as userA → 403 — PLANNED')
})

// Note on 403 vs 404: requireHouseholdAccess throws 403 for non-members.
// Routes that first findUnique the resource and only THEN call requireHouseholdAccess
// (e.g. /api/lists/[id]) return 404 for unknown ids and 403 for known-but-foreign.
// Both outcomes must prevent data leakage; assert the response body contains
// NO foreign data (only { error: string }).
```

**Why this is sufficient:** because the API is the sole enforcement point and every household-scoped route funnels through `requireHouseholdAccess`/`requireHouseholdManager`, a regression here (a route that forgets the call) is the only way cross-household leakage can occur. The matrix above covers every household-scoped route discovered under `src/app/api/`. Add a new case whenever a new household-scoped route is introduced (enforce via an ESLint rule or a "routes inventory" test that greps for `requireHouseholdAccess`).

---

## 6. End-to-end (Playwright) scenarios  *(5 scenarios — PLANNED)*

```ts
// tests/e2e/golden-shopping.spec.ts
describe('E2E: golden shopping path', () => {
  it('demo seed → login as alex@demo.shopnest → create list → add item → start shopping mode → purchase → finish → snapshot visible — PLANNED', async () => {
    // POST /api/demo/seed; login; POST /api/households/[id]/lists; POST /api/lists/[id]/items;
    // POST /api/households/[id]/shopping-sessions; PATCH /api/items/[id] {status:PURCHASED, actualPriceCents};
    // PATCH /api/shopping-sessions/[id] (finish); assert summary.purchased.length===1, spentCents matches.
  })
})

// tests/e2e/photo-confirmation.spec.ts
describe('E2E: photo confirmation approve flow', () => {
  it('shopper attaches photo + asks family → family approves → item stays PENDING with approved badge — PLANNED', async () => {
    // Two browser contexts (shopper + family). POST photo; POST confirmation;
    // PATCH confirmation {action:decide, decision:APPROVED, version:1};
    // assert realtime converges; GET /api/items/[id]/confirmations shows status APPROVED.
  })
})

// tests/e2e/offline-sync.spec.ts
describe('E2E: offline add → reconnect → sync', () => {
  it('throttle network to offline, add an item (queued), restore network, assert item appears server-side after flush — PLANNED', async () => {
    // context.setOffline(true); add item → toast "Saved offline"; setOffline(false);
    // wait for queue flush; GET list → item present.
  })
  it('permanent 4xx while offline (e.g. delete a non-existent item) is removed from the queue, not retried forever — PLANNED')
})

// tests/e2e/realtime-convergence.spec.ts
describe('E2E: two-client realtime convergence', () => {
  it('client A adds an item; client B (same household, different browser) sees it without manual refresh — PLANNED')
})
```

---

## 7. CI strategy

**Plan only — the actual workflow file is `.github/workflows/ci.yml` (to be created in an authorized environment; not created by this sandbox).**

### 7.1 Matrix & triggers

- **Triggers:** `push` to `main`, `pull_request` to `main`.
- **OS:** `ubuntu-latest`.
- **Runtime matrix:** `node@20` (with `bun`) — single lane to start; add `node@22` later.
- **Concurrency:** cancel in-progress runs for the same ref.

### 7.2 Jobs

1. **lint-build-typecheck** (always-on, fast):
   - `bun install --frozen-lockfile`
   - `bun run lint` (eslint)
   - `bun run db:generate` (prisma generate — typecheck needs the client)
   - `bunx tsc --noEmit`
   - `bun run build` (next build) — catches RSC/client-boundary regressions.
2. **unit** (Vitest):
   - `bun install --frozen-lockfile`
   - `bunx prisma db push --skip-generate --schema prisma/schema.prisma` against a temp `DATABASE_URL="file:./ci-test.db"` (SQLite file, deleted between runs).
   - `bunx vitest run --coverage` (unit + api + rls).
   - Upload coverage report (`actions/upload-artifact@v4`).
3. **e2e** (Playwright, allow-failure initially, then required):
   - Start the Next dev server (`bun run dev`) **and** the socket service (`bun mini-services/shopnest-socket/index.ts`) as `playwright.config.ts` `webServer` entries.
   - `bunx playwright test`.
   - Upload HTML report + traces on failure.

### 7.3 Test-DB hygiene

- Each CI run uses a fresh `ci-test.db` (deleted in `actions/cache` post-step or via `rm -f`).
- Per-test truncation lives in `tests/vitest.setup.ts` (§1.4) — no shared state between `it()` blocks.
- Prisma migrations are **not** used for the test DB (schema drift risk); `prisma db push` reconciles the schema directly.

### 7.4 Gates

- `lint-build-typecheck` + `unit` are **required** to merge.
- `e2e` is **required** once green on `main`; until then it runs as informational (`continue-on-error: true`).

---

## 8. Coverage targets

Realistic, per-area goals (measured by `@vitest/coverage-v8` line + branch). These are **targets for the authorized implementation**, not current numbers.

| Area | Target line cov. | Rationale |
|---|---|---|
| `src/lib/shopnest/money.ts` | **100%** | pure, critical, decimal-safety — must be fully exercised |
| `src/lib/shopnest/voice.ts` | **≥95%** | pure parser; the only untested branch is the obscure trailing-number fallback |
| `src/lib/shopnest/api-helpers.ts` (`validatePhotoDataUrl`, `parseBody`) | **100%** | security-relevant (SVG rejection, size cap) |
| `src/lib/shopnest/auth.ts` (`requireUser`/`requireHouseholdAccess`/`requireHouseholdManager`/session lifecycle) | **≥95%** | the entire RLS enforcement lives here |
| `src/app/api/auth/*` | **≥90%** | |
| `src/app/api/households/**` (incl. join/invite/leave/members) | **≥90%** | |
| `src/app/api/lists/**`, `items/**` | **≥85%** | highest traffic; store-attribution P0 paths covered |
| `src/app/api/households/[id]/outstanding` + `stores` | **100%** | the P0 regression — every branch must be locked |
| `src/app/api/shopping-sessions/**` | **≥90%** | finish-summary math is subtle |
| `src/app/api/confirmations/**` + `items/[id]/confirmations` | **≥90%** | version-conflict paths are easy to break |
| `src/app/api/households/[id]/budgets` | **≥85%** | four spend scopes |
| `src/app/api/households/[id]/price-observations` | **≥80%** | grouping logic |
| `src/app/api/households/[id]/pantry/**` | **≥85%** | |
| `src/app/api/events/**` + `event-items/**` | **≥85%** | copy-to-list idempotency is the lock |
| `src/lib/shopnest/client.ts` (offline queue) | **≥90%** | flush rules are correctness-critical |
| **Project overall** | **≥85%** | |

Coverage is a **floor, not a ceiling**: the RLS matrix (§5) and P0 store-count matrix (§4.5) must pass regardless of percentage.

---

## 9. Honesty log

| Metric | Value |
|---|---|
| Tests executed in this environment | **0** |
| Tests passed | **0** |
| Tests failed | **0** |
| Test runner installed | **No** (`vitest`, `@playwright/test` not in `package.json`) |
| Test files on disk | **0** (no `.test.ts`/`.spec.ts`/`__tests__/`/config files created) |
| `vitest.config.ts` created | **No** (shown as a documentation code block only) |
| `playwright.config.ts` created | **No** (shown as a documentation code block only) |
| Test cases outlined in this document | **225** (210 across the 15 feature areas + 12 RLS + 5 E2E; counted from actual `it()` blocks) |
| Status of every outlined case | **PLANNED — NOT YET EXECUTED** |
| Gaps discovered | **1**: account-deletion endpoint missing (UI calls `DELETE /api/auth/register`; route only exports `POST` → 405). See §4.15. |
| Manual verification already on record | See the prior version of this file and `SHOPNEST_V2_AUDIT.md`; manual checks are NOT automated tests and are not re-counted here. |
| Next action | In an authorized environment: install dev deps (§1.2), create the directory layout (§2), implement the `describe`/`it` skeletons (§4–§6), wire CI (§7), then re-run and replace every "PLANNED" with PASS/FAIL evidence. |

---

### Appendix A — Real endpoints referenced by this plan

(Discovered via `src/app/api/`; every path below is exercised by at least one planned case.)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
PATCH  /api/auth/prefs
GET    /api/households
POST   /api/households
POST   /api/households/join
GET    /api/households/[id]
PATCH  /api/households/[id]
DELETE /api/households/[id]
POST   /api/households/[id]/invite
POST   /api/households/[id]/leave
PATCH  /api/households/[id]/members/[memberId]
DELETE /api/households/[id]/members/[memberId]
GET    /api/households/[id]/lists
POST   /api/households/[id]/lists
GET    /api/households/[id]/stores
POST   /api/households/[id]/stores
GET    /api/households/[id]/outstanding
GET    /api/households/[id]/budgets
POST   /api/households/[id]/budgets
GET    /api/households/[id]/pantry
POST   /api/households/[id]/pantry
PATCH  /api/households/[id]/pantry/[pantryId]
DELETE /api/households/[id]/pantry/[pantryId]
GET    /api/households/[id]/events
POST   /api/households/[id]/events
GET    /api/households/[id]/shopping-sessions
POST   /api/households/[id]/shopping-sessions
GET    /api/households/[id]/price-observations
POST   /api/households/[id]/price-observations
GET    /api/households/[id]/price-compare
GET    /api/households/[id]/confirmations
GET    /api/households/[id]/history
GET    /api/households/[id]/activity
POST   /api/households/[id]/plan          (returns 402 while payments disabled)
GET    /api/lists/[id]
PATCH  /api/lists/[id]
DELETE /api/lists/[id]
POST   /api/lists/[id]/items
GET    /api/items/[id]/confirmations
POST   /api/items/[id]/confirmations
PATCH  /api/confirmations/[id]
POST   /api/items/[id]/photos
DELETE /api/items/[id]/photos?photoId=
GET    /api/items/[id]/comments
POST   /api/items/[id]/comments
PATCH  /api/items/[id]
DELETE /api/items/[id]
GET    /api/shopping-sessions/[id]
PATCH  /api/shopping-sessions/[id]
GET    /api/events/[id]
PATCH  /api/events/[id]
DELETE /api/events/[id]
POST   /api/events/[id]/items
PATCH  /api/event-items/[id]
DELETE /api/event-items/[id]
POST   /api/events/[id]/copy-to-list
POST   /api/events/[id]/duplicate
POST   /api/demo/seed                      (rate-limited: 6th call/min → 429)
GET    /api/admin/stats
GET    /api/admin/users
PATCH  /api/admin/users/[id]               (last-admin guard → 409)
GAP:   DELETE /api/auth/account            (does not exist; UI currently hits DELETE /api/auth/register → 405)
```

### Appendix B — Real helper functions referenced

- `src/lib/shopnest/auth.ts`: `requireUser`, `getSessionUser`, `createSession`, `destroySession`, `refreshSessionIfNeeded`, `requireHouseholdAccess`, `requireHouseholdManager`, `generateInviteCode`, `hashPassword`, `verifyPassword`, `jsonError`, `ApiError`, `SESSION_COOKIE` (`'sn_session'`).
- `src/lib/shopnest/money.ts`: `dollarsToCents`, `formatCents`, `normalizeUnit`, `computeUnitPriceCents`, `isPriceStale`, `PRICE_STALE_DAYS`.
- `src/lib/shopnest/voice.ts`: `parseVoiceCommand`, `speechSupported`, `VOICE_UNITS`.
- `src/lib/shopnest/api-helpers.ts`: `parseBody`, `logActivity`, `validatePhotoDataUrl` (regex `^data:image/(png|jpe?g|webp|gif);base64,`, `MAX_PHOTO_BYTES = 700_000`).
- `src/lib/shopnest/client.ts`: `api`, `getQueue`, `flushQueue`, `enqueue`, `OfflineQueuedError`, `ApiClientError`, `getSessionToken`/`setSessionToken`/`clearSessionToken`, `refreshSession`, `migrateLegacyToken`.
- `src/lib/shopnest/notify.ts`: `broadcastHousehold` (POSTs to `http://127.0.0.1:3004/internal/emit`), `broadcastMany`, `SyncEventType` union.
- `src/lib/shopnest/rate-limit.ts`: `rateLimit`, `clientKey`.

---

*End of plan. This document contains zero executed tests and zero on-disk test files. Implement in an authorized environment per §1.*
