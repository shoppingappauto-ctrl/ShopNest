# ShopNest V2 — Roadmap (P0..P5)

Status markers: ✅ shipped · 🟡 shipped with caveats · ⏳ pending.
This plan reflects what actually shipped in each phase and what remains. Phase boundaries are delivery checkpoints, not dates — no dates are promised.

---

## P0 — Correctness baseline (✅ shipped)

Goal: make existing MVP numbers and state trustworthy before adding V2 features.

| Item | Status |
|---|---|
| Canonical store-attribution rule: item's own `storeId` only; list store = default for new items; "Unassigned" group; no list-store fallback | ✅ |
| ARCHIVED-list items excluded from outstanding/stores/session-finish counts | ✅ |
| Last-admin guard on the platform admin portal (409 on demoting/suspending final admin) | ✅ |
| Household delete broadcasts `household:changed` before cascade | ✅ |
| Case-insensitive store duplicate check (409) | ✅ |
| Photo validator: raster-only whitelist (PNG/JPEG/WebP/GIF), corrected messages | ✅ |
| `timesPurchased` no-op increment removed; increments on purchase only | ✅ |
| Missing activity/broadcast coverage (stores CRUD, item store-moves) | ✅ |

## P1 — Money as a first-class concept (✅ shipped)

| Item | Status |
|---|---|
| `money.ts`: integer-cents convention, `dollarsToCents` (decimal-safe parsing), `formatCents` | ✅ |
| `ShoppingItem.estimatedPriceCents / actualPriceCents / priceCurrency` | ✅ |
| Estimate auto-captured as actual price on purchase transition (explicit actual wins) | ✅ |
| `ShoppingBudget` scopes TRIP / WEEKLY / MONTHLY / EVENT; GET computes spend per scope | ✅ |
| Catalog stats (`lastPurchasedAt`, `timesPurchased`) updated on purchase | ✅ |

## P2 — Shopping Mode & family coordination (✅ shipped)

| Item | Status |
|---|---|
| `ShoppingSession` start/finish; finish builds snapshot JSON (purchased/unavailable/remaining), `spentCents` | ✅ |
| `ItemConfirmationRequest` lifecycle PENDING → APPROVED / REJECTED / SUBSTITUTE_SUGGESTED / CANCELLED | ✅ |
| Optimistic concurrency via `version` (409 on stale decision, no silent overwrite) | ✅ |
| Photo attached to confirmation requests (household-scoped, raster-only) | ✅ |
| `EventItem.assignedToId` (assign checklist tasks to members) | ✅ |
| Event → list copy with dedupe via `EventItem.shoppingItemId` link (idempotent re-runs) | ✅ |
| `HouseholdEvent.isTemplate` + duplicate-as-template | ✅ |

## P3 — Price Memory, Pantry, Catalog search (✅ shipped)

| Item | Status |
|---|---|
| `PriceObservation`: household-scoped history, source labels (USER_ENTERED / RECEIPT / RETAILER_AUTHORIZED / PARTNER_FEED / COMMUNITY) | ✅ |
| Unit-price normalization (kg / L / pc bases, g·lb·oz·ml·gal·dozen factors), computed at write time | ✅ |
| Staleness: observations > 60 days flagged (`isPriceStale`); price-compare view per product/store | ✅ |
| `PantryItem` statuses IN_STOCK / RUNNING_LOW / OUT_OF_STOCK / UNKNOWN | ✅ |
| Catalog aliases (English/Bangla) + `GET /api/catalog` search across curated + household products | ✅ |
| Halal tags remain informational; API never certifies | ✅ |

## P4 — Accessibility, voice, prefs, realtime polish (🟡 shipped with caveats)

| Item | Status |
|---|---|
| `User.notifyPrefs` JSON (purchases/comments/reminders) + in-app notification feed | ✅ |
| `User.largeText` accessibility mode (caregiver/elderly friendly) | ✅ |
| Voice add: deterministic client-side regex parser, quantity/unit/store extraction, EN + Bangla numerals/units, confidence levels | ✅ |
| Web Speech API capture (free, on-device browser recognition) | 🟡 Chrome/Edge/Safari vary; graceful "unsupported" path |
| CHIPS partitioned session cookie for iframe contexts | 🟡 Safari lacks CHIPS; Bearer-token fallback covers it while localStorage works |
| Offline mutation queue flush on socket reconnect | ✅ |
| Voice/photo **error telemetry** in admin stats | ⏳ client-side analytics not built; noted in `v2.note` |

## P5 — Productionization (⏳ pending — nothing here has shipped)

| Item | Status | Notes |
|---|---|---|
| Automated test suite (unit + API integration + e2e) | ⏳ | Spec cases listed in TESTING doc; no runner exists in repo today |
| Payments/billing activation (Stripe + app-store IAP) | ⏳ | Blocked on owner approval + credentials; `POST /plan` returns 402 until then |
| Authenticated socket rooms (token verification on `join`) | ⏳ | Single-tenant sandbox mitigation currently |
| Native iOS/Android clients | ⏳ | Web only |
| Client-side analytics pipeline (voice/photo error rates) | ⏳ | Required for the admin v2 metrics to be real |
| Shared/Redis-backed rate limiting; multi-instance support | ⏳ | In-memory per-process limiter today |
| Migrations (`prisma migrate`) instead of `db push` for prod | ⏳ | Current workflow is push + file backup |
| Production deployment | ⏳ | **None performed — sandbox only** |

---

## Acceptance criteria per phase (what "done" meant)

| Phase | Acceptance criteria (all met for shipped phases) |
|---|---|
| P0 | Stores page counts === outstanding groups for mixed-assignment lists; archived items invisible in all pending counts; admin portal cannot lose its last admin; SVG uploads rejected |
| P1 | No float money anywhere; budget spend matches purchased prices exactly; purchase transition captures price once |
| P2 | A two-user confirmation round-trip never silently overwrites (409 on stale version); re-running event copy never duplicates items |
| P3 | Same product+unit compared across stores shows normalized prices; >60-day observations visibly stale; "ilish" finds Hilsa in catalog search |
| P4 | Voice command "add two gallons of milk to Walmart" parses correctly; session survives iframe cookie blocking via Bearer fallback |
| P5 | (pending) test suite green in CI; payments live behind approval; socket rooms authenticated; telemetry populating admin v2 metrics |

## Sequencing rationale

- P0 preceded all V2 work because store counts feed Shopping Mode, budgets (TRIP scope), and price comparisons — building on a wrong attribution rule would have multiplied the error.
- P1's integer-cents convention was a prerequisite for P2 session spend and P3 unit prices (no float money anywhere).
- P2's confirmation `version` concurrency landed before realtime-adjacent features multiplied concurrent editors.
- P5 items are gated on external approvals (payments) or new infrastructure (tests, telemetry, multi-instance), not on feature work.
