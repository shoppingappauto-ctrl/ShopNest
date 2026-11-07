# ShopNest V2 — Billing & Entitlements

**Status: DISABLED. No payment provider is integrated, no API keys exist, no customer has ever been charged, and no paid service can be activated by any client.** This document preserves the existing entitlement/subscription design and prepares the architecture for a future RevenueCat (mobile IAP) + Stripe (web) integration that will only be turned on after explicit approval.

---

## 1. Current state (verified in code)

| Aspect | State | Where |
|---|---|---|
| Plans | `FREE` and `PLUS` exist as a `Household.plan` flag only | `prisma/schema.prisma`, `src/lib/shopnest/types.ts` |
| PLUS price | `$3.99 / household / month` constant (display only) | `src/lib/shopnest/constants.ts` (`PLUS_PRICE_PER_MONTH`) |
| Upgrade attempt | Returns **402 Payment Required** with `{ paymentsEnabled: false }` | `src/app/api/households/[id]/plan/route.ts` |
| Admin MRR | Computed from `plan` flags, explicitly labeled "payments disabled — plan flags only" | `src/app/api/admin/stats/route.ts`, `src/components/shopnest/admin-view.tsx` |
| Marketing UI | PlusDialog shows the price and benefits but the CTA is non-functional | `src/components/shopnest/plus-dialog.tsx` |
| Payment provider SDK | **None** — no Stripe, no RevenueCat, no storekit, no billing client | (absent from `package.json` and `apps/mobile/package.json`) |
| Entitlement enforcement | No feature is secretly gated behind PLUS — PLUS is a badge only today | `src/components/shopnest/app-shell.tsx`, `household-view.tsx` |

Nothing in this build charges anything. The 402 is the hard guarantee.

## 2. What is preserved (must not regress)

- The `FREE | PLUS` plan vocabulary and `Household.plan` column.
- The `paymentsEnabled` flag returned by `/api/admin/stats` and the plan route (clients already branch on it).
- The PlusDialog marketing surface and the admin "payments disabled" labeling.
- The integer-cents money utilities (`src/lib/shopnest/money.ts`) reused by budgets/price-memory — the billing layer will reuse the same minor-unit convention.

## 3. RevenueCat-ready architecture (future, NOT activated)

The design below is the target. **None of it is implemented or wired to live keys.** It exists so that activation is a configuration step, not a redesign.

### 3.1 Source of truth
- The server `Household.plan` column remains the single source of truth for entitlement. Clients never trust a local "subscribed" flag for gating.
- Entitlement is resolved server-side on every authorized request via the existing `requireHouseholdAccess` helper (which already loads the membership + household). A thin `getEntitlement(householdId)` reads `plan` + a future `planExpiresAt` column.

### 3.2 Channels
| Channel | Provider | Flow |
|---|---|---|
| Mobile (iOS/Android) | **RevenueCat** | App calls RevenueCat SDK → Apple/Google IAP → RevenueCat validates receipt → RevenueCat webhook hits our server → server sets `Household.plan = PLUS` + `planExpiresAt` |
| Web | **Stripe Checkout + Billing Portal** | `POST /api/billing/checkout` creates a Stripe Session → customer pays → Stripe webhook (`customer.subscription.created/updated`) → server sets plan |

### 3.3 New endpoints (to be added when approved — none exist today)
- `POST /api/billing/checkout` — creates a Stripe Checkout Session for a household (web).
- `POST /api/billing/portal` — creates a Stripe Billing Portal session (manage/cancel).
- `POST /api/webhooks/stripe` — verifies `Stripe-Signature`, idempotently sets `Household.plan` + `planExpiresAt` from the subscription status.
- `POST /api/webhooks/revenuecat` — verifies the RevenueCat signature, idempotently sets `Household.plan` + `planExpiresAt` from the entitlement grant.
- `GET /api/households/[id]/entitlement` — returns the current entitlement + expiry (server-authoritative; mobile reads this, not the RC SDK, before trusting PLUS).
- `POST /api/households/[id]/plan` (existing) — repurposed from 402 to either redirect to checkout (web) or return a RevenueCat `offerings` package identifier (mobile).

### 3.4 Schema additions (when activated — NOT added now)
- `Household.planExpiresAt DateTime?`
- `Household.stripeCustomerId String?`
- `Household.revenueCatAppUserId String?` (defaults to household id)
- `SubscriptionEvent` model (idempotency log: provider, eventId, type, householdId, createdAt) so webhooks are de-duplicated.
- A migration — **reversible**, additive only; no existing column is dropped or retyped.

### 3.5 Security requirements (must hold at activation)
- Webhook signature verification on **every** webhook (Stripe `Stripe-Signature`; RevenueCat `Authorization` bearer). Unsigned or stale requests are rejected.
- Idempotency: every webhook event is logged by provider `eventId`; replays are no-ops.
- Entitlement is **never** set by a client request directly — only by a verified webhook or a server-side checkout completion.
- Grace period: when a subscription lapses, `planExpiresAt` is honoured (not an instant downgrade) to tolerate payment retries (dunning).
- Admin MRR then reads from the payment provider (via `SubscriptionEvent` aggregation), not from plan flags — closing the current "flag-only" approximation.
- The existing last-admin guard pattern is mirrored: a household can never be left without an owner due to a billing edge case.

### 3.6 Mobile (apps/mobile) integration points (future)
- Add `react-native-purchases` (RevenueCat SDK) to `apps/mobile/package.json`.
- A `lib/billing.ts` that fetches the RC offering, calls `Purchases.purchasePackage`, and then re-fetches `GET /api/households/[id]/entitlement` (server-authoritative) before reflecting PLUS in the UI.
- The secure credential store (`expo-secure-store`) is **not** used for payment state — payment state lives server-side. RC's own SDK manages the app-store receipt.

## 4. Explicit non-activation guarantees

- `paymentsEnabled` is hard-coded `false` in two places (`plan/route.ts`, `admin/stats/route.ts`). Activation requires editing those plus adding the provider keys — there is no runtime toggle.
- No `.env` key for `STRIPE_SECRET_KEY`, `REVENUECAT_API_KEY`, or `RC_WEBHOOK_AUTH` exists in the repo or the sandbox environment.
- `apps/mobile/app.json` declares **no** IAP capability / no store kit entitlements file.
- The CI workflow (`.github/workflows/ci.yml`) performs no billing action.

## 5. Activation checklist (requires human approval — do NOT auto-execute)

1. Obtain Stripe key set + RevenueCat project + Apple/Google IAP products.
2. Add the schema columns in §3.4 via a reversible Prisma migration; run `bun run db:push` after review.
3. Implement the endpoints in §3.3 with signature verification + idempotency.
4. Set `paymentsEnabled = true` (sourced from an env flag, not hard-coded) only after the webhook path is verified end-to-end on a staging environment.
5. Wire `react-native-purchases` in `apps/mobile` and submit IAP products to App Store Connect / Google Play Console for review.
6. Replace admin MRR flag-math with `SubscriptionEvent` aggregation.
7. Only after all of the above: announce pricing. Until then, the 402 stands.

**Until every step above is completed and approved, billing remains disabled and no customer can be charged.**
