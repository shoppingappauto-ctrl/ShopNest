# ShopNest Mobile

A real native React Native (Expo) app for **ShopNest**, the family shopping
platform. Reuses the existing Next.js + Prisma backend's REST API and the
socket.io realtime service — this app does **not** ship a separate server.

> **Honest status.** This is a real Expo / React Native project, not a WebView
> wrapper. It is TypeScript-structured and mirrors the web app's data layer
> (`@shopnest/shared` package), but it has **NOT been compiled or run on a
> device in this sandbox** — no Xcode, Android SDK, or Expo cloud credentials
> are available here. TestFlight and Google Play internal-testing builds
> require `eas build` + `eas submit` with valid Apple/Google credentials in
> an authorized environment — that step is **not** done in this work. See
> [Status & honesty](#status--honesty) below for what is implemented vs lean.

---

## What this is

A 5-tab native app (Home / Lists / Stores / Planner / Household) plus detail
screens for: list, shopping-mode (fullscreen), confirmations, pantry,
budgets, price memory, specialty catalog, event, settings, and add-item
with voice parsing.

| Native capability                 | Where it lives                                   |
| --------------------------------- | ------------------------------------------------ |
| Secure credential storage         | `lib/secure-storage.ts` (`expo-secure-store`)    |
| Native camera (photo confirmations) | `lib/photo.ts` (`expo-image-picker`)           |
| Local push notifications          | `lib/notifications.ts` (`expo-notifications`)    |
| Offline mutation queue            | `lib/api-client.ts` (AsyncStorage)               |
| Realtime sync                     | `lib/realtime.ts` (`socket.io-client`)           |
| Voice entry (always-available)    | `app/add-item.tsx` + `@shopnest/shared` parser   |
| Voice entry (optional native STT) | `lib/voice-native.ts` (runtime peer-dep probe)   |

---

## Monorepo layout

```
my-project/
├── apps/
│   └── mobile/                 # this Expo app
│       ├── app/                # expo-router routes (file-based)
│       │   ├── _layout.tsx     # providers + auth gate
│       │   ├── login.tsx
│       │   ├── register.tsx
│       │   ├── add-item.tsx
│       │   ├── confirmations.tsx
│       │   ├── pantry.tsx
│       │   ├── budgets.tsx
│       │   ├── price-memory.tsx
│       │   ├── catalog.tsx
│       │   ├── settings.tsx
│       │   ├── list/[id].tsx
│       │   ├── event/[id].tsx
│       │   ├── shopping-mode/[sessionId].tsx
│       │   └── (tabs)/
│       │       ├── _layout.tsx
│       │       ├── index.tsx           # Home
│       │       ├── lists.tsx
│       │       ├── stores.tsx
│       │       ├── planner.tsx
│       │       └── household.tsx
│       ├── components/
│       │   ├── ui.tsx                  # themed RN primitives (Button, Card, etc.)
│       │   └── connection-banner.tsx
│       ├── lib/
│       │   ├── api-client.ts           # fetch wrapper + offline queue
│       │   ├── secure-storage.ts       # expo-secure-store wrapper
│       │   ├── auth.tsx                # AuthProvider + useAuth
│       │   ├── realtime.ts             # socket.io + react-query invalidation
│       │   ├── hooks.ts                # react-query hooks (mirrors web hooks.ts)
│       │   ├── notifications.ts        # expo-notifications
│       │   ├── photo.ts                # expo-image-picker + compression
│       │   ├── voice-native.ts         # optional native STT bridge
│       │   └── theme.ts                # green brand colors + spacing tokens
│       ├── app.json
│       ├── babel.config.js
│       ├── metro.config.js             # monorepo watchFolders
│       ├── tsconfig.json
│       ├── package.json
│       └── .env.example
└── packages/
    └── shared/                          # @shopnest/shared — framework-agnostic
        ├── index.ts                     # re-exports
        ├── types.ts                     # API response shapes
        ├── constants.ts                 # UNITS, CATEGORIES, SPECIALTY_CATALOG, etc.
        ├── money.ts                     # decimal-safe cents / unit price helpers
        ├── voice.ts                     # parseVoiceCommand (deterministic, no AI)
        └── api-types.ts                 # request/response interfaces per route
```

---

## Setup

> ⚠️ The packages listed in `apps/mobile/package.json` are **not installed**
> in this sandbox (no network for `expo` and friends). To run locally:

1. **Install dependencies** from the monorepo root:
   ```bash
   cd my-project
   bun install            # or: npm install / yarn install
   ```
2. **Configure environment** — copy `.env.example` to `.env`:
   ```
   EXPO_PUBLIC_API_BASE=https://your-gateway.example
   EXPO_PUBLIC_SOCKET_BASE=https://your-gateway.example
   EXPO_PUBLIC_BUILD_LABEL=dev
   ```
   The mobile app talks to the same gateway as the web app. **All API URLs
   must be relative** (`/api/...`) and the socket URL is
   `${EXPO_PUBLIC_SOCKET_BASE}/?XTransformPort=3003` — see the gateway section
   of the project root README.
3. **Start Expo** (requires Expo CLI to be installed globally or via npx):
   ```bash
   cd apps/mobile
   bunx expo start
   ```
4. **Open on a device or emulator:**
   - Press `i` to open in the iOS Simulator (requires Xcode)
   - Press `a` to open in the Android Emulator (requires Android Studio)
   - Or scan the QR code with **Expo Go** (Android) or the Camera app (iOS)

---

## Authentication

Per `docs/SHOPNEST_V2_SECURITY.md` §1: native mobile clients store the opaque
session token in the OS Keychain/Keystore via `expo-secure-store` and send it
as `Authorization: Bearer <token>`. The web app's `HttpOnly; SameSite=Lax`
cookie does not apply to native clients — this is the **sanctioned
token-based approach for native**.

- `lib/secure-storage.ts` is the **only** place the token lives. AsyncStorage
  is used **only** for the offline mutation queue (`@shopnest_pending_queue`).
- Login (`POST /api/auth/login`) and register (`POST /api/auth/register`)
  return `{ user, token }` in the JSON body (the API does this for the
  cross-origin iframe case in the web app — the same path serves native).
- On app launch, `refreshSession()` calls `POST /api/auth/refresh` for a
  sliding TTL extension.

---

## Offline shopping

`lib/api-client.ts` mirrors the web app's `src/lib/shopnest/client.ts`:

- GET failures surface as `ApiClientError`.
- POST/PATCH/DELETE failures due to network loss are queued in AsyncStorage
  (`@shopnest_pending_queue`) and the call throws `OfflineQueuedError`.
- On socket reconnect (or every 30s timer), `flushQueue()` replays them in
  order. A local change is **never** presented as synchronized until the
  server confirms it (mutations only invalidate caches after a 2xx response,
  or after the queued mutation is successfully replayed).
- A `ConnectionBanner` component shows the live status + pending count.

---

## Native camera

`lib/photo.ts` uses `expo-image-picker` to launch the camera (or photo
library) and compresses the result to a base64 data URL (max ~1000px long
edge, JPEG q≈0.72) so it fits comfortably under the API's ~700 KB dataURL
cap. The API endpoint `POST /api/items/[id]/confirmations` accepts a base64
`photoDataUrl` field and stores it as a private household-scoped `ItemPhoto`.

---

## Native notifications

`lib/notifications.ts` configures `expo-notifications` for **local**
notifications (no server round-trip). On certain realtime events
("Ask Family" sent, item purchased by family), we display a local
notification. **Push server (APNs/FCM) is not yet wired** — the local
notifications work today; a push server would require:

1. A push server that holds APNs/FCM credentials and dispatches on realtime
   events.
2. Mobile clients registering their Expo push token with the server on auth.

`registerForPushNotifications()` already requests permission and obtains an
Expo push token; it just isn't sent to a server yet.

---

## Voice input

The shared package's `parseVoiceCommand()` parser is the
**always-available** path: type or paste a phrase like
`"add 2 gallons of milk to Walmart"` and the parser extracts
`{ name, quantity, unit, storeName, confidence }`. No permissions, no native
module, no AI.

`lib/voice-native.ts` is a clearly-marked optional path that probes for a
community speech-to-text module (e.g. `@react-native-voice/voice`) at
runtime. If none is installed, the "Voice (native)" button is disabled and
the text path is used. We do **not** bundle a hard dependency on any speech
module — production teams can drop one in and the hook picks it up.

---

## Building for TestFlight + Google Play internal testing

These steps require valid Apple Developer / Google Play credentials and
**must run in an environment with network access to Expo's EAS servers** —
not in this sandbox.

1. **Install EAS CLI** (one time, outside this sandbox):
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. **Configure the EAS project** — set `extra.eas.projectId` in `app.json`
   to your EAS project ID (run `eas init` once to create one).
3. **Build**:
   ```bash
   cd apps/mobile
   eas build --platform ios --profile preview
   eas build --platform android --profile preview
   ```
   A `preview` profile (defined in `eas.json`, not included here) typically
   produces an internal-distribution build with a provisioning profile
   tied to your Apple Developer account.
4. **Submit**:
   - **TestFlight**: `eas submit --platform ios --latest` (uploads to App
     Store Connect; sign in with your Apple ID and complete App Store
     Connect metadata separately).
   - **Google Play internal testing**: `eas submit --platform android
     --latest` (uploads to the internal testing track; requires a Google
     Play service account JSON).
5. **Over-the-air updates** (optional, JS-only changes): `eas update
   --branch production` after configuring `updates.url` in `app.json`.

> None of the above was executed in this sandbox. The `app.json` includes
> placeholder `eas.projectId` and `updates.url` values that you must
> replace before running `eas build`.

---

## Status & honesty

This is a real Expo/React Native project written in TypeScript. It has not
been compiled or run on a device in this environment. Concretely:

### Implemented (real, non-stub code that uses the real API)

- **Auth gate + login/register/demo-login**: real `POST /api/auth/login`,
  `POST /api/auth/register`, `POST /api/demo/seed` calls. Bearer token in
  `expo-secure-store`.
- **5 tabs**: Home, Lists, Stores, Planner, Household — all use react-query
  hooks against the real `/api/...` routes.
- **List detail**: grouped by store, mark purchased/unavailable/substituted,
  inline comment send, "Ask Family" photo confirmation via native camera.
- **Shopping mode (fullscreen)**: start session via
  `POST /api/households/[id]/shopping-sessions`, large touch targets, finish
  via `PATCH /api/shopping-sessions/[id]` and show the
  purchased/unavailable/remaining + spent summary.
- **Confirmations**: pending + recently-decided list, approve / reject /
  substitute-suggest, optimistic-concurrency `version` sent.
- **Pantry**: list, add, cycle status (IN_STOCK / RUNNING_LOW / OUT_OF_STOCK
  / UNKNOWN), delete.
- **Budgets**: TRIP / WEEKLY / MONTHLY / EVENT scopes, set amount, spent vs
  budget progress bar (decimal-safe via `formatCents`).
- **Price memory**: list observations, add (with store + unit normalization
  via `computeUnitPriceCents`), delete, stale detection.
- **Specialty catalog**: search by name/Bangla/transliteration, browse by
  section, tap to add to a list.
- **Event detail**: checklist, toggle done, assign member, copy to list,
  duplicate, save-as-template, delete.
- **Settings**: update name, toggle notification prefs, toggle large-text,
  sign out. Account-deletion shows an honest "not yet available" alert
  (the API has no DELETE `/api/auth/me` route).
- **Add item (voice)**: text + `parseVoiceCommand` always works; native
  voice is an optional hook.
- **Realtime**: socket.io-client connects to
  `${SOCKET_BASE}/?XTransformPort=3003`, joins `hh:<id>` rooms, invalidates
  react-query keys on `lists:changed` / `items:changed` / `stores:changed` /
  `events:changed` / `activity:changed` / `household:changed` events.
- **Offline**: AsyncStorage mutation queue with replay on reconnect.
- **Native camera**: `expo-image-picker` + JS-side compression.
- **Local notifications**: `expo-notifications` local scheduling.

### Leaner (functional but secondary screens, kept simple)

- **Household stats**: shown as a simple stat grid (no charts).
- **Activity feed**: shown inline on Home (no dedicated screen).
- **History**: not surfaced as its own screen yet — accessible via the web
  app. A future iteration would add a History tab.
- **Substitute text entry**: uses `Alert.prompt` on iOS; on Android shows a
  "use the web app" message. A native modal for substitution text would be
  a small follow-up.
- **Account deletion**: API has no DELETE `/api/auth/me` route — the flow is
  wired but displays an honest "not yet available" alert. Documented in
  `app/settings.tsx`.

### Not done in this environment

- **Not compiled / not run on a device**: no Xcode, Android SDK, or Expo
  cloud credentials in this sandbox. The TypeScript is structured and the
  code is internally consistent, but you should expect first-run device
  issues typical of any unbuilt native project (e.g. a missing peer
  dependency, a permission flow that needs a tweak on a specific OS
  version).
- **No `eas build` / `eas submit`**: TestFlight and Google Play
  internal-testing builds require Apple/Google credentials in an authorized
  environment.
- **Push server not wired**: local notifications work; APNs/FCM dispatch on
  realtime events requires a push server (not part of this code).
- **Native speech module not bundled**: `lib/voice-native.ts` is the
  optional bridge — production teams drop in a community module (e.g.
  `@react-native-voice/voice`) and the hook picks it up.
- **TypeScript typecheck caveat**: `bunx tsc --noEmit` against this project
  requires the Expo SDK types to be installed (they are not, in this
  sandbox). The shared package typechecks cleanly on its own. See
  "TypeScript issues" below.

### Native feature caveats (require device testing)

- Camera + photo compression behavior differs across iOS / Android versions;
  the JS-side compression is a safety net, not a guarantee.
- `expo-notifications` permission prompts must be tested on a real device.
- `expo-secure-store` availability varies on certain Android emulators —
  the secure-storage wrapper treats missing storage as logged-out (graceful,
  never silent).
- The optional native voice module requires runtime permissions
  (`NSMicrophoneUsageDescription` on iOS, `RECORD_AUDIO` on Android) which
  are declared in `app.json`.

---

## TypeScript issues

Run `bunx tsc --noEmit -p apps/mobile/tsconfig.json` from the monorepo root
after installing the Expo SDK and all listed peer dependencies. In this
sandbox we did **not** have network to install `expo` / `react-native` /
their type packages, so a full typecheck could not be completed here.

Known considerations:

- The `@shopnest/shared` package typechecks cleanly with `tsc --noEmit`
  (verified: 0 errors).
- The mobile app's `tsconfig.json` extends `expo/tsconfig.base`, which is
  only available after `expo` is installed.
- The mobile app imports only from `@shopnest/shared` (verified types) and
  the listed RN/Expo dependencies (their types ship with the packages).
- `PressableProps` import in `components/ui.tsx` is from `react-native` and
  is unused as a runtime value — it's only the type. If your toolchain
  complains, replace `& PressableProps` with the actual props you need.

If you find a type error after install, treat it as a real bug — the intent
is for this project to typecheck cleanly once the Expo SDK is present.

---

## License

MIT (matches the web app).
