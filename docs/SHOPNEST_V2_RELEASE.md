# ShopNest V2 — Release Checklist & Rollout Notes

**Deployment status: no production release has been performed.** The app runs in a sandbox preview environment only. This checklist records what is done, what is verified (manually), and what remains before a real rollout.

Legend: ✅ done · 🟡 done, verified manually only · ⏳ pending.

---

## 1. Release checklist

### Build & run
| Item | Status | Notes |
|---|---|---|
| Schema applied to `db/custom.db` (`prisma db push`) | ✅ | Expand-only V2 changes; no destructive ops |
| `npm run build` (Next standalone output) | 🟡 | Sandbox build; not exercised on clean prod hardware |
| `npm start` (bun standalone server, port 3000) | 🟡 | Sandbox only |
| Socket mini-service running (ports 3003 public / 3004 internal) | ✅ | `mini-services/shopnest-socket`; Caddy proxies `/?XTransformPort=3003`; 3004 must stay localhost-only |
| Reverse proxy config (Caddy) | ✅ | Path `/` socket forwarding preserved — do not change socket path |
| Env: `DATABASE_URL` | ✅ | Points at SQLite file |

### Functional readiness
| Item | Status | Verification |
|---|---|---|
| Auth (cookie + Bearer fallback) in iframe context | 🟡 | Manual, two browsers; Safari/CHIPS caveat documented |
| Canonical store counts (P0 fix) | 🟡 | Manual matrix in TESTING doc; no automated regression guard yet |
| V2 features (sessions, confirmations, budgets, price memory, pantry, events, voice) | 🟡 | Manual flows, all passing |
| Offline queue + realtime convergence | 🟡 | Manual incl. socket-down and offline drills |
| Admin portal + last-admin guard | 🟡 | Manual with two admin accounts |
| Automated test suite | ⏳ | **None exists** — blocking for a confident production release |
| Payments/billing | ⏳ | Disabled by policy (`POST /plan` → 402); requires owner approval + Stripe/IAP credentials |
| Client telemetry for voice/photo errors | ⏳ | Admin v2 metrics honestly marked unavailable |

### Data & rollback
| Item | Status |
|---|---|
| Pre-release DB backup (`cp db/custom.db db/custom.db.bak-<label>`) | ✅ procedure documented (DATABASE §8) |
| Migration rollback path (file restore) | ✅ expand-only changes; no destructive migrations run |
| Demo seed re-runnable after restore | ✅ idempotent, rate-limited |

## 2. Rollout notes (when a production deploy is approved)

### Runbook commands

```bash
# build & run (app)
npm run build            # next build + standalone assembly
npm start                # NODE_ENV=production bun .next/standalone/server.js (port 3000)

# schema (no migration files exist; push is the current workflow)
npm run db:generate && npm run db:push

# realtime service
bun mini-services/shopnest-socket/index.ts   # 3003 public, 3004 internal

# backup before any deploy
cp db/custom.db "db/custom.db.bak-$(date +%Y%m%d-%H%M)"
```

### Post-deploy smoke test (5 checks, all curl-able)

1. `GET /api/auth/me` with a fresh login → 200 (cookie **and** Bearer paths).
2. `GET /api/households/[id]/stores` vs `.../outstanding` → per-store pending counts agree.
3. `POST /api/demo/seed` ×2 → identical household reused (idempotent).
4. Socket: second browser receives an item change without refresh.
5. `GET /api/admin/stats` (as admin) → `billing.paymentsEnabled === false`, `v2.note` present.

### Provisioning & environment

| Item | Requirement |
|---|---|
| Processes | One Next.js standalone instance + one socket mini-service on the same host. The API degrades gracefully (polling/focus refetch) if the socket service is down, but realtime is part of the product |
| Ports | 3000 app; 3003 socket (Caddy-proxied via `/?XTransformPort=3003`); **3004 must never be exposed** — it is the internal emit API |
| Env | `DATABASE_URL` (SQLite file path); no other secrets exist — no payment/email/API keys are configured |
| Data | `db/custom.db` present or recreated via `db:push` + demo seed |
| Known single-instance assumptions | In-memory rate limiter, in-memory socket presence, SQLite single-writer — all break silently under horizontal scaling (acceptable now, documented in COSTS) |

### Platform caveats

- **Safari note**: in third-party iframes the CHIPS cookie may not persist; the Bearer-token fallback keeps sessions alive while localStorage is available. First-party usage is unaffected.
- **Demo endpoint**: keep `POST /api/demo/seed` enabled only if demo credentials are acceptable in that environment; it is rate-limited (5/min/IP) and idempotent, but it does create real rows.

## 3. Rollback

- App: redeploy previous standalone build; no schema backwards-compatibility issues because V2 changes were additive (old code ignores new columns/tables).
- Data: stop app → restore `db/custom.db` from the pre-release backup → restart. Verify via admin stats + outstanding counts (see DATABASE §8).

## 4. Post-release monitoring (manual today)

- Admin portal: DAU/WAU/MAU, households/items counts, photo storage estimate, v2 feature adoption counters, MRR (flags-only, honestly labeled).
- Server logs: `[shopnest-api]` (unhandled 500s), `[shopnest-socket]` (connections/rooms).
- ⏳ No automated alerting, uptime checks, or error-rate dashboards exist — pending with the telemetry work in P5.

## 5. Explicit non-goals for this release

- No claims of production hardening: no automated tests, no alerting, no multi-instance support, no payments.
- No native mobile clients; web only.
- No real deployments were performed — every "verified" marker above refers to the sandbox environment.
