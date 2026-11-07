# ShopNest V2 — Testing Status & Plan

**Honest headline: no automated test suite ships in this build.** There is no test runner (`vitest`/`jest`/`playwright`) in `package.json`, no test directories for the app (the `tests/` folder contains environment bootstrap shell scripts only). All verification below was performed **manually** — browser flows, two simultaneous sessions for realtime, and curl for API behavior. The automated plan at the end is future work (P5), listed as pending.

---

## 1. What was verified manually, and how

| Area | Verified behavior | Method |
|---|---|---|
| Auth flows | Register → login → `/api/auth/me`; logout invalidates session; suspended user rejected; token survives reload via localStorage fallback when cookies blocked (iframe) | Two browsers, incl. iframe/preview context; curl with/without Bearer |
| Demo seeding | `POST /api/demo/seed` idempotent (re-runs reuse "The Demo Family"); 6th call within a minute → 429 | curl loop |
| **Canonical store counts (P0)** | Items appear under **exactly one** store (their own `storeId`) in outstanding view; list default store does not absorb them; unassigned items → "Unassigned" group; stores-page `_count` matches outstanding groups; ARCHIVED-list items excluded from both; moving an item between stores updates both immediately | Mixed-assignment list built in UI; counts compared between Stores page and outstanding view before/after moves and archiving |
| Shopping session lifecycle | Start (optionally store/list-scoped) → purchase some, mark unavailable → finish → snapshot JSON records purchased/unavailable/remaining, `spentCents` = actual (estimate fallback); unfinished items remain on list; double-finish → 409 | UI walkthrough + curl `PATCH /api/shopping-sessions/[id]` |
| Confirmation lifecycle | Request (with photo) → approve / reject / substitute (name recorded) / cancel by requester only; stale `version` → 409 "just updated by someone else"; decided request re-decision → 409 | Two browsers; explicit version-mismatch curl |
| Budgets | TRIP (per-list spend), EVENT (spend via EventItem links), WEEKLY/MONTHLY windows; amount + computed spend agree with purchased prices (integer cents, no drift) | Created each scope; cross-checked totals against list history |
| Prices & price compare | Observation with unit (`gal`, `kg`, `dozen`…) → normalized `unitPriceCents` per basis; compare view shows latest + lowest per store; >60-day observations flagged stale; source labels retained | curl + UI; stale case via backdated row |
| Pantry | Create/update items through IN_STOCK / RUNNING_LOW / OUT_OF_STOCK / UNKNOWN; household-scoped list | UI |
| Events: copy & dedupe | Copy-to-list creates linked items; **re-running copies nothing** (`copied: 0`, `skipped: n`); assignee persists; duplicate-as-template creates `isTemplate` event with checklist | Repeat POST `/api/events/[id]/copy-to-list` twice |
| Realtime sync | Two logged-in users: item add/edit/move, store create, comment, photo → other client updates without refresh; socket down → 30s/focus refetch converges; status chip live/offline | Two browsers; socket service stopped deliberately |
| Offline queue | Airplane-mode mutation → queued (toast "Saved offline"); back online → auto-flush and refetch; permanent 4xx removed from queue | Browser network throttling |
| Voice add | "add two gallons of milk to Walmart" → qty 2, unit gal, store Walmart (high confidence); Bangla numerals ("৫ কেজি") parsed; unsupported browser shows graceful fallback | Chrome (SpeechRecognition) + manual parser checks |
| Admin portal | Stats reflect real counts (incl. v2 metrics + honest `v2.note`); suspend blocks login; **last-admin demote/suspend → 409** | Two admin accounts |
| Guards/regressions | Store duplicate (case-insensitive) → 409; household delete broadcasts → other client drops state; SVG photo → rejected with corrected message; 9th photo → 403 | curl + UI |
| Money parsing | `"3.48"`, `"$3.48"`, `"3.5"` → 348/348/350 cents; invalid strings rejected | Manual checks in UI price fields |

## 2. Required automated test plan (⏳ pending — P5)

The following cases are the spec's test obligations. None are automated today; each is written as the test it should become.

**Unit tests (pure functions — cheapest, highest value first)**
- `money.ts`: `dollarsToCents` ("3.48", "$3.48", "3.5", "", "1.005" rounding, negatives/NaN rejection); `computeUnitPriceCents` across kg/L/pc factors (g, lb, oz, gal, dozen); `isPriceStale` boundary at 60 days.
- `voice.ts`: "add two gallons of milk to Walmart" → `{name:"Milk", qty:2, unit:"gal", storeName:"Walmart", confidence:"high"}`; Bangla digits/units; "milk" alone → medium/low confidence; unit-word not mistaken for store tail.
- `api-helpers.ts`: `validatePhotoDataUrl` accepts PNG/JPEG/WebP/GIF, rejects SVG and oversize; `parseBody` error shape.

**API integration tests (route handlers against a scratch SQLite DB)**
- Auth: register/login/logout; expired session; suspended user; Bearer-vs-cookie equivalence.
- **Canonical store rule (regression lock for the P0 fix)**: items never counted under the list store; unassigned grouping; ARCHIVED exclusion; stores `_count` === outstanding groups.
- Item purchase transition: estimate→actual capture, `timesPurchased` increment exactly once, purchasedAt/buyer set and cleared on revert.
- Confirmations: full lifecycle; version conflict → 409; cancel rules.
- Budgets: spend computation per scope (TRIP/EVENT/WEEKLY/MONTHLY), upsert-by-target replacement.
- Events: copy-to-list idempotency (`skipped` counting), duplicate-as-template.
- Stores: case-insensitive duplicate → 409; store move broadcasts.
- Admin: non-admin → 403; **last-admin guard** → 409; stats payload honesty (`paymentsEnabled:false`, `v2.note` present).
- Plan: `POST /plan` → 402 while payments disabled.
- Rate limit: 6th demo-seed call within a minute → 429.

**End-to-end (browser)**
- Two-user realtime convergence; offline queue flush; shopping session start→finish with snapshot; voice add happy path; photo attach/confirm flow.

**Suggested tooling** (not installed yet): Vitest for unit/integration, Playwright for e2e, a CI job running `prisma db push` against a temp DB file.

## 3. Reproducing the key manual checks (curl)

Session bootstrap (cookie jar + Bearer):

```bash
curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"alex@demo.shopnest","password":"shopnest123"}' | tee /tmp/sn.json
TOKEN=$(node -e "console.log(require('/tmp/sn.json').token)")
H="-H \"Authorization: Bearer $TOKEN\""
```

Canonical store-count check (the P0 regression):

```bash
# stores page counts (items per store, PENDING, non-archived)
curl -s $H localhost:3000/api/households/<hhId>/stores | jq '.stores[] | {name, items: ._count.items}'
# outstanding groups (must agree; "Unassigned" for null storeId)
curl -s $H localhost:3000/api/households/<hhId>/outstanding | jq '.groups[] | {storeName, n: (.items|length)}'
```

Other one-liners used during verification:

```bash
# confirmation version conflict → expect 409
curl -s -X PATCH $H localhost:3000/api/confirmations/<id> -H 'Content-Type: application/json' \
  -d '{"action":"decide","decision":"APPROVED","version":1}'
# demo seed rate limit → 6th call inside a minute expects 429
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/demo/seed; done
# SVG photo rejection → expect 400 with raster message
curl -s -X POST $H localhost:3000/api/items/<id>/photos -H 'Content-Type: application/json' \
  -d '{"dataUrl":"data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="}'
# payments disabled → expect 402
curl -s -o /dev/null -w '%{http_code}\n' -X POST $H localhost:3000/api/households/<hhId>/plan
```

## 4. Regression risks while tests are absent

Highest-risk invariants that manual testing covers but nothing automatically guards:
1. Store attribution rule (any new count path must not reintroduce list-store fallback).
2. ARCHIVED exclusion in any new "outstanding"-style query.
3. Confirmation `version` conflict handling.
4. Last-admin guard.
5. Photo MIME whitelist.
