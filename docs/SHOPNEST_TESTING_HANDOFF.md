# ShopNest — Automated Testing Handoff (Authorized Environment)

**Status: the sandbox that built ShopNest prohibits writing and executing test code. No test code exists in the repo and none was executed — zero tests passed, zero failed, zero run.** This handoff converts the approved 225-case plan (`docs/SHOPNEST_V2_TESTING.md`) into an exact, step-by-step implementation procedure for an engineer in an environment where writing and running tests is authorized. Do not mark any test "passing" until it has actually been executed there.

---

## 1. Ground rules

- Implement against the code in branch `feature/v2-secure-testing-mobile` (or its merge target). Real endpoints and helpers referenced below were verified to exist in that tree.
- Every case in TESTING.md §4 (210), §5 RLS (12) and §6 E2E (5) carries an ID-style heading — implement in the priority order of §2 below, not file order.
- Nothing here requires modifying application code; if an implementation reveals an app bug, file it separately and keep the test asserting current intended behavior (or update the plan deliberately).

## 2. Implementation order (priority per product direction)

| Order | Area | TESTING.md § | Suggested file | Why first |
|---|---|---|---|---|
| 1 | Auth & sessions | 4.1 | `tests/api/auth.test.ts` | All other suites need a session helper |
| 2 | Household authorization | 4.2 | `tests/api/households-authz.test.ts` | Foundation for every 403 assertion |
| 3 | Cross-household security (RLS-style) | 5 | `tests/rls/cross-household.test.ts` | Highest-severity security net |
| 4 | Multi-store count consistency | 4.5 | `tests/api/store-counts.test.ts` | Known historical bug class |
| 5 | Shopping Mode | 4.6 | `tests/api/shopping-mode.test.ts` | Core loop |
| 6 | Photo confirmation | 4.7 | `tests/api/photo-confirmations.test.ts` | Includes MIME/size rejection cases |
| 7 | Price calculations | 4.10 | `tests/unit/money.test.ts` | Pure functions — fastest wins |
| 8 | Offline synchronization | 4.14 | `tests/unit/offline-queue.test.ts` | Pure client logic (jsdom) |
| 9 | Real-time updates | 4.4 | `tests/integ/realtime.test.ts` | Needs socket service running |
| 10+ | Remaining areas | 4.3, 4.8–4.9, 4.11–4.13, 4.15 | per §4 | Lists, substitutions, budgets, pantry, voice, events, account deletion |

## 3. One-time setup (copy-paste)

```bash
bun add -d vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
bun add -d @playwright/test && bunx playwright install --with-deps chromium
# isolated test DB (never touch db/custom.db):
export DATABASE_URL="file:./db/test.db"
bunx prisma db push --skip-generate
```

Configs: copy the `vitest.config.ts`, `vitest.setup.ts` and `playwright.config.ts` blocks from TESTING.md §1 verbatim into the repo root. `.github/workflows/ci.yml` already contains the `unit-and-api` and `e2e` jobs — they activate automatically when the first `tests/**/*.test.ts` / `tests/e2e/**/*.spec.ts` files land; no CI edit needed.

Session helper used by all API suites (TESTING.md §1 shows the full version): POST `/api/auth/login` → capture `token` → send `Authorization: Bearer <token>`; cookie jar optional. For household suites create TWO users and TWO households and cross-test.

## 4. Per-area implementation notes (gotchas verified against the code)

- **Auth (4.1)**: `/api/auth/refresh` returns `{ok, refreshed, expiresAt}` and only extends within 7 days of expiry — to test the `refreshed:true` branch, `UPDATE Session SET expiresAt` to `now+3d` in the test DB first. Cookie assertions: `HttpOnly`, `SameSite=Lax`, `Secure` (Playwright context.cookies()).
- **Household authz (4.2/5)**: `requireHouseholdAccess` 403s non-members; `requireHouseholdManager` 403s MEMBER/CAREGIVER; OWNER cannot be removed/demoted (409/403 paths). RLS table in §5 lists endpoint × operation × expected status — implement as a data-driven `it.each`.
- **Multi-store counts (4.5)**: canonical rule = per-ITEM `storeId`, never inherited from the list. Assert list card, store card and `/outstanding` agree for: item with store, item without store, item in ARCHIVED list (excluded), purchased item (excluded).
- **Shopping Mode (4.6)**: POST `/api/households/:id/shopping-sessions` closes any prior ACTIVE session; finish PATCH sets purchasedCount/unavailableCount/remainingCount/spentCents (spent = actual ?? estimate fallback).
- **Photo confirmations (4.7)**: POST `/api/items/:id/confirmations` accepts inline `photoDataUrl`; SVG data URLs are rejected; ~700 KB cap; decisions via PATCH `/api/confirmations/:id` `{action:'decide',decision,version}` with optimistic concurrency (stale version → 409-class).
- **Price calculations (4.10)**: `dollarsToCents`, `formatCents`, `computeUnitPriceCents` in `src/lib/shopnest/money.ts` (mirrored in `packages/shared/money.ts`) — table-driven float cases (0.1+0.2 class).
- **Offline sync (4.14)**: `src/lib/shopnest/client.ts` — enqueue on network failure, flush on reconnect/online/mutation; 4xx (≠408) drops from queue, 5xx keeps. jsdom + mocked fetch.
- **Realtime (4.4)**: start the service (`cd mini-services/shopnest-socket && bun index.ts`), connect two clients, join `hh:<id>`, mutate via API with user A's token, assert user B's client receives `items:changed`. (Live-verified manually in Chromium; see FINAL_READINESS §3.)
- **Voice (4.12)**: pure `parseVoiceCommand` — see TESTING.md §4.12 tables (English/Bangla numerals, units, store tails, confidence).
- **Account deletion (4.15)**: DELETE `/api/auth/account` — owner-of-others → 403; sole-owner household deleted; non-owner's added items reassigned to household OWNER (assert `addedById` moved); user row gone; sessions gone.

## 5. Definition of done

- [ ] All 225 cases implemented or explicitly descoped in writing
- [ ] `bunx vitest run` green locally and in CI (`unit-and-api` job)
- [ ] `bunx playwright test` green locally and in CI (`e2e` job)
- [ ] No test flakiness across 3 consecutive CI runs
- [ ] Fill the honesty log below (replace zeros with real numbers)

## 6. Honesty log (to be updated in the authorized environment)

| Metric | Value |
|---|---|
| Tests implemented | 0 |
| Tests executed | 0 |
| Passed / Failed / Skipped | 0 / 0 / 0 |
| Executed by / date / environment | — |
