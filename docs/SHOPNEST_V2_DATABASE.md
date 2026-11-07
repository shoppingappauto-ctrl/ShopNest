# ShopNest V2 — Database Reference

Prisma 6 + SQLite. Schema: `prisma/schema.prisma`. DB file: `db/custom.db` (set via `DATABASE_URL`).
SQLite has **no native enums** — enum-like fields are validated strings, enforced at the API boundary with zod.

---

## 1. Accounts

### User
| Field | Type | Purpose |
|---|---|---|
| `email` | unique | Login identity |
| `passwordHash` | string | bcrypt (cost 10) |
| `avatarColor` | default `#16a34a` | Avatar chips |
| `isAdmin` / `isSuspended` | bool | Platform admin portal; suspension blocks auth |
| `emailVerified` | default false | Email delivery disabled in this build |
| `notifyPrefs` | string? | **V2** JSON `{"purchases":true,"comments":true,"reminders":true}` |
| `largeText` | bool | **V2** accessibility (large-text mode) |
| `lastActiveAt` | datetime | DAU/WAU/MAU; touched max once/60s from `getSessionUser` |

Relations: sessions, memberships, comments, activities, added/purchased items, confirmations requested/decided, price observations, event assignments.

### Session
Opaque token (two concatenated UUIDs) as primary key, stored in the `sn_session` cookie / sent as Bearer. `expiresAt` (30-day TTL), cascade on user delete. Index: `userId`.

## 2. Households & membership

### Household
`name`, `inviteCode` (unique, `SN-XXXXXX`), `plan` (`FREE | PLUS` — PLUS requires payment activation, **disabled**). Owns all household-scoped collections.

### HouseholdMember
`role`: `OWNER | ADMIN | MEMBER | CAREGIVER` (default MEMBER). Unique `(householdId, userId)`; index `userId`. CAREGIVER = delegated shopping access; authorization-wise it is a non-manager (same gate as MEMBER).

### Store
`category` (`SUPERMARKET | HALAL | BANGLADESHI | ASIAN | BUTCHER | FISH | OTHER`), `isFavorite`, `verified` (**always false** — user-entered; never shown as verified external listing). Index `householdId`.

## 3. Lists & items

### ShoppingList
`storeId` is a **default for newly created items only** — never used for attribution of existing items (see AUDIT §3). `status`: `ACTIVE | COMPLETED | ARCHIVED` (ARCHIVED excludes items from all outstanding counts). Index `householdId`.

### ShoppingItem
| Field | Notes |
|---|---|
| `name`, `nameBn` | Bangla names for specialty groceries |
| `quantity` (Float), `unit` | `pc·kg·g·lb·oz·L·ml·gal·pack·dozen·bunch` |
| `status` | `PENDING | PURCHASED | UNAVAILABLE | SUBSTITUTED` (+ `substitutedWith`) |
| `storeId` | **Canonical store attribution — never inherited from the list**; null = Unassigned; `onDelete: SetNull` |
| `estimatedPriceCents` / `actualPriceCents` | **V2**, integer minor units (zod max 100,000,000); estimate auto-captured as actual on purchase |
| `priceCurrency` | **V2**, default `USD` |
| `favoriteProductId` | Link to catalog product; `SetNull` |
| `purchasedAt` / `purchasedById` | Set on PENDING→PURCHASED transition; cleared on revert |

Indexes: `listId`, `householdId`.

### ItemPhoto
`dataUrl` = base64 data URL stored **in the DB** (private, household-scoped; client compresses first; server cap ~700 KB dataURL, 8 photos/item). Index `itemId`.

### ItemComment
`kind`: `COMMENT | APPROVE | REJECT | SUBSTITUTE`. Index `itemId`.

### ItemConfirmationRequest (**V2**)
| Field | Notes |
|---|---|
| `status` | `PENDING | APPROVED | REJECTED | SUBSTITUTE_SUGGESTED | CANCELLED` |
| `photoId` | Optional attached photo; `SetNull` |
| `substituteName` | Set when `SUBSTITUTE_SUGGESTED` |
| `version` | Optimistic concurrency: decisions carry the version they saw; mismatch → 409; increments on decision |
| `decidedById/At`, `decisionNote` | Decision record |

Indexes: `itemId`, `(householdId, status)`.

## 4. Shopping Mode, budgets, price memory, pantry (**V2**)

### ShoppingSession
`status` `ACTIVE | FINISHED`; optional `listId`/`storeId` filters (null = all). On finish: `purchasedCount`, `unavailableCount`, `remainingCount`, `spentCents` (actual, fallback estimate), and `snapshotJson` (full item snapshot). Finish excludes ARCHIVED lists and only counts purchases after `startedAt`. Index `(householdId, startedAt)`.

### ShoppingBudget
`scope`: `TRIP` (needs `listId`) · `WEEKLY` · `MONTHLY` · `EVENT` (needs `eventId`). `amountCents` integer; `periodStart` anchors WEEKLY/MONTHLY. One active budget per target (upsert-by-target). Index `(householdId, scope)`.

### PriceObservation
| Field | Notes |
|---|---|
| `itemName` / `nameBn` / `productId?` | Product identity; product link `SetNull` |
| `storeId?` / `storeName?` | Denormalized name so history survives store deletion |
| `totalPriceCents` | What was paid/seen (integer) |
| `unitPriceCents` / `unitPriceBasis` | Normalized per canonical basis (`kg`/`L`/`pc`), computed at write time |
| `source` | `USER_ENTERED | RECEIPT | RETAILER_AUTHORIZED | PARTNER_FEED | COMMUNITY` |
| `observedAt` | Stale after **60 days** (`PRICE_STALE_DAYS`) |

Indexes: `(householdId, itemName)`, `productId`.

### PantryItem
`status`: `IN_STOCK | RUNNING_LOW | OUT_OF_STOCK | UNKNOWN` (default UNKNOWN); optional `householdProductId` link (`SetNull`); `lastUpdatedAt` via `@updatedAt`. Index `householdId`.

## 5. Catalog, events, activity

### HouseholdProduct
`name`, `nameBn`, `defaultQty`, `unit`, `storeId?`, `aliases` (**V2**: JSON `string[]`, e.g. `"ilish","hilsa","ish"`), `isFavorite`, `isRecurring` + `recurrenceDays`, `lastPurchasedAt`, `timesPurchased` (increments **only** on purchase transition). Index `householdId`.

### HouseholdEvent
`type`: `BIRTHDAY | EID | RAMADAN | WEDDING | GATHERING | BBQ | HOLIDAY | BABY_SHOWER | OTHER`; `status`: `PLANNING | COMPLETED`; **`isTemplate` (V2)** marks reusable templates. Index `householdId`.

### EventItem
Checklist entry: `storeId?`, `isDone`, **`assignedToId` (V2**, member responsible, `SetNull`), **`shoppingItemId` (V2)** — explicit link set when copied to a list; makes copy-to-list idempotent (linked items skipped). Index `eventId`.

### Activity
Household-scoped feed: `type` (ITEM_ADDED, ITEM_PURCHASED, CONFIRMATION, BUDGET, PANTRY, PRICE, STORE, …), `message`, optional `user` (`SetNull`). Index `(householdId, createdAt)`.

---

## 6. SQLite / Prisma notes

- **Enums as strings**: validated with zod at every API entry point; adding a value requires no migration.
- **Floats**: `quantity`/`unit` fields are Float — acceptable for quantities; **never used for money** (§7).
- **Schema application**: `npm run db:push` (note: the script passes `--accept-data-loss` — review any schema change before pushing; there are no migration files in the repo).
- **`onDelete` choices**: user/household deletions cascade; optional references (`storeId`, `favoriteProductId`, `photoId`, `assignedToId`, `shoppingItemId`, purchasedBy) use `SetNull` so history rows survive.
- **Concurrency**: SQLite single-writer; the app targets a single Next.js instance. `version`-based optimistic concurrency on confirmations and last-write-wins elsewhere are deliberate simplifications for this deployment model.

## 7. Money-as-integer-cents convention

- All monetary columns end in `Cents` (or `spentCents`/`amountCents`/`totalPriceCents`) and store **integer minor units**.
- Parsing happens once at the edge: `dollarsToCents("3.48")` → `348` (string arithmetic + rounding; rejects `$`, `,`, whitespace; no float math).
- Display: `formatCents(348)` → `"$3.48"`.
- Unit-price normalization (`computeUnitPriceCents`) rounds once, at write time, into `unitPriceCents`.
- Budgets and session spend sum integers server-side. Client inputs are converted before hitting the API (`z.number().int()` guards every money field).

## 8. Backup, rollback, recovery

- The entire database is one file: **`db/custom.db`**. Backup = stop writes and copy the file (`cp db/custom.db db/custom.db.bak-<label>`); restore = copy back and restart.
- V2 was **expand-only**: new tables + nullable/defaulted columns. Rolling back to the pre-V2 schema would not lose MVP data (new columns would be dropped, but no existing column changed type or meaning). In practice the file copy is the rollback artifact — no destructive migration was run.
- Recovery checks after restore: `GET /api/admin/stats` (counts sane), `GET /api/households/[id]/outstanding` (store groups), login (Session rows intact).
- Demo data is reproducible at any time via `POST /api/demo/seed` (idempotent, rate-limited 5/min/IP).
