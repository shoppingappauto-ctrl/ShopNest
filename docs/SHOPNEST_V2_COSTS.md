# ShopNest V2 — Costs

Infrastructure of record and the cost posture of this build. **No external paid services are activated.** Everything below is verifiable in the repo.

---

## 1. Infrastructure of record (current, $0 external)

| Component | Runtime | Cost today |
|---|---|---|
| Next.js app + API | Single Node/Bun process (port 3000) | Sandbox host — no metered spend |
| Socket.io mini-service | Single process, ports 3003 (public) / 3004 (localhost emit) | Same host |
| Database | SQLite single file (`db/custom.db`) | Disk only; no DB service |
| Reverse proxy | Caddy (already running in sandbox) | None |
| Speech recognition | Browser Web Speech API (client-side) | **Free**; no cloud STT |
| Image processing | Client canvas compression (`compress.ts`) | Free; server does no re-encoding |
| Payments / email / OCR / retailer price feeds / maps | Not integrated | $0 — and no keys exist |

No API keys, no third-party SaaS, no CDN, no object storage are configured anywhere in the codebase.

## 2. What would cost money at scale (and the trigger for each)

| Cost driver | Current state | When it starts costing | Rough lever |
|---|---|---|---|
| App hosting | One sandbox box | When user count exceeds one small instance; sticky sessions needed once socket presence matters | Vertical first, then 2× app + LB (breaks in-memory rate limit/sockets — see guardrails) |
| Database | SQLite file | Concurrent-write contention; backups/compliance needs | Postgres managed instance; migration is straightforward (schema is standard Prisma) |
| Realtime | Self-hosted socket.io | Multi-instance fanout | Redis adapter for socket.io |
| Rate limiting | In-memory | Multi-instance | Shared store (Redis) — same dependency as above |
| Photo storage | Base64 in SQLite (~700 KB cap/photo, 8/item) | DB file bloat; backup size | Object storage (S3-class) — **deliberately deferred**; a household's realistic photo volume stays small |
| Speech recognition | Web Speech API | Safari/Firefox gaps or mobile apps needing reliable STT | Paid STT API — **not activated**; feature degrades gracefully instead |
| Price data | User-entered observations only | If RETAILER_AUTHORIZED/PARTNER_FEED sources are ever populated | Commercial data licensing — enum exists, **no feed integrated** |
| Payments | Flags only (402) | When Stripe/IAP approved | Stripe per-transaction fees + app-store 15–30% cut on IAP |
| Email | Disabled (`emailVerified` unused) | Verification/reset emails | Transactional email provider |

## 3. Guardrails already in place (cost + abuse)

| Guardrail | Where | Effect |
|---|---|---|
| No paid APIs activated | Whole codebase (no keys/SDK calls) | Zero variable cost is possible today |
| Free Web Speech API only | `voice.ts` (`speechSupported()`) | Voice works where the browser provides it; no server-side inference |
| Deterministic client-side voice parser | `voice.ts` regex parser | No NLP/LLM spend per command; parsing costs 0 CPU server-side |
| Client-side image compression | `compress.ts` (max 1000px, JPEG q≈0.72) before upload | Cuts upload/storage size before any server cost accrues |
| Server-side photo caps | ~700 KB dataURL cap + 8 photos/item | Bounds worst-case per-item storage |
| Rate limiting | `rate-limit.ts`; demo seed 5/min/IP | Blunts the cheapest abuse vector (fixed demo creds) |
| Bounded queries | `take: 200` price history, `take: 40` catalog, `take: 20` household products, 500-row confirmation sample in stats | No unbounded result sets |
| Integer-cents money | `money.ts` | No float-money correctness churn (a time cost, not dollars) |
| Realtime payloads are notifications only | `notify.ts` broadcasts type + ts | Socket bandwidth stays negligible vs. refetches |
| Best-effort broadcast w/ 1.5s timeout | `broadcastHousehold` | Realtime can never add latency or failure to API responses |
| Admin metrics from real data only | `admin/stats` | No purchased analytics stack |

## 4. Cost-relevant design decisions (made in code, kept deliberately)

| Decision | Code | Cost rationale | Trade-off accepted |
|---|---|---|---|
| Photos as base64 rows, not object storage | `ItemPhoto.dataUrl`, 8/item, ~700 KB cap | No storage service, no egress bill | DB file growth; migration to S3-class later |
| Client-side speech + parsing | `voice.ts` (Web Speech API + regex) | Zero per-command inference cost | Browser support gaps; graceful fallback |
| Client-side image compression | `compress.ts` before upload | Smaller payloads before any server cost | JPEG-only re-encode; no server-side variants |
| Price Memory is user-entered only | `PriceObservation.source` defaults `USER_ENTERED` | No data-licensing spend; enum ready if a feed is ever licensed | No live retailer prices (honest UI labeling) |
| Notifications = invalidation hints | `realtime.ts` refetches; `notify.ts` sends type+ts | Tiny socket frames; no fanout payload cost | Slightly more refetch traffic (idempotent) |
| In-app activity feed instead of email/push | `Activity` table | No email/push provider spend | Notifications only visible in-app |
| Money as integer cents | `money.ts`, all `*Cents` columns | Avoids decimal library + float-correctness bugs | Display layer does formatting |

## 5. Unit-economics notes

- Revenue side exists as flags only: `PLUS` @ $3.99/household/month (`PLUS_PRICE_PER_MONTH`), with MRR computed from flags and explicitly labeled as reflecting plan flags, not collected payments. **Do not treat it as revenue until payments ship (P5).**
- The heaviest potential variable cost per active household would be photos; current design (client compression + hard caps + DB storage) keeps this near-zero until an object-storage migration.
- The heaviest potential per-request cost would be price/retailer data; current design records only household-entered observations (`USER_ENTERED`), so price features cost nothing per query.
- Voice features cost zero per use by construction: the parser is local regex and recognition is the browser's — there is no server round-trip for either.

## 6. Scaling cost sketch (order-of-magnitude, for planning only)

| Stage | Likely first purchases | Estimated monthly shape |
|---|---|---|
| ≤ a few hundred households (current) | Nothing | $0 external (single host) |
| First real deployment | Small VPS/app platform + automated DB-file backups | Low tens of $/mo |
| Multi-instance / reliability | Postgres + Redis (rate limits + socket adapter) + object storage for photos | Low hundreds $/mo |
| Voice upgrades or price data | Paid STT API and/or retailer data license | Variable, usage/licensing-based — gated behind explicit approval |

Numbers are planning placeholders, not quotes — no vendor is selected or contacted.

## 7. Summary

Current spend: **$0 external**. Current risk: capacity, not cost — the stack is three processes and a file on one host. The next real dollar is triggered by exactly one decision: activating payments (Stripe/IAP) after approval, or scaling past a single instance (hosting + Postgres + Redis), or licensing retailer price data. None of those is wired, and the code contains no hidden dependencies on any of them.
