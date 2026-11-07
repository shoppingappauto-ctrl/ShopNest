# ShopNest — Native Mobile Release Plan (Expo / React Native)

**Status: the native app in `apps/mobile` is scaffolded but has NEVER been compiled, installed or run on a device or simulator. No TestFlight or Google Play build exists. Nothing below should be read as a shipped binary.** This plan takes the existing scaffold to internal-testing builds using the EXISTING backend — the web app is untouched and remains the primary client.

---

## 1. What already exists (verified in repo)

- `apps/mobile/` — Expo Router app: 5 tabs mirroring web (Home/Lists/Stores/Planner/Household), list detail, full-screen Shopping Mode, confirmations, pantry, budgets, price memory, specialty catalog, event detail, settings, add-item with voice parsing.
- `apps/mobile/lib/` — API client with Bearer auth + AsyncStorage offline mutation queue; `expo-secure-store` credential storage; socket.io realtime; react-query hooks mirroring web; notifications; photo picker/compression.
- `packages/shared/` — framework-agnostic types, constants, money, voice parser (typechecks clean, `tsc --noEmit` exit 0).
- Backend: unchanged Next.js API + socket.io mini-service + SQLite — the mobile app is purely a new client.

## 2. Architecture / migration decision (no backend migration required)

| Concern | Decision | Rationale |
|---|---|---|
| Backend | **Reuse as-is** | All household authorization is server-side (`requireHouseholdAccess`); mobile is just another Bearer-token client — the token path already exists for the iframe fallback |
| Database | **Reuse as-is** | Single source of truth; no mobile-specific tables needed today |
| Auth | Opaque session token in **Keychain/Keystore** (`expo-secure-store`), `Authorization: Bearer` on every request | HttpOnly web cookie does not apply to native; sanctioned by SECURITY.md §1 |
| Realtime | Same socket.io service via gateway (`/?XTransformPort=3003`) | One fanout path for web + mobile |
| Offline | Mirror of web queue (AsyncStorage) | Identical semantics, replay on reconnect |
| Push | Local notifications now; remote push later (APNs key + FCM + server) | Remote dispatch is a server feature, not required for internal testing |

## 3. Required credentials and services (owner actions)

| # | Credential / service | Cost | Used for | Where it goes |
|---|---|---|---|---|
| 1 | **Apple Developer Program** account (individual or org) | $99/yr | TestFlight + App Store, APNs push key | App Store Connect |
| 2 | App Store Connect **Admin/App Manager** access + done app record | — | Builds, testers, TestFlight groups | ASC web |
| 3 | Apple **APNs Auth Key** (.p8) or cert | free w/ #1 | Remote push (later) | Expo dashboard |
| 4 | **Google Play Console** developer account | $25 one-time | Internal testing track | play.google.com/console |
| 5 | Android **upload keystore** (or Play App Signing) | — | Signing AAB | `eas credentials` |
| 6 | **FCM** project + server key (later) | free | Android push | Expo dashboard |
| 7 | **Expo account (EAS)** + `EAS_TOKEN` | free tier OK | Cloud builds (`eas build`), submissions | `eas login` / CI secret |
| 8 | Apple **App-specific password / API key** for `eas submit` | — | Automated TestFlight upload | `eas.json` / CI secret |
| 9 | Device farm or physical devices (BrowserStack/real) | varies | iOS Safari, Android Chrome, native app QA | QA |

None of these exist in the repo or sandbox; nothing can be built or published without them. **Do not publish without owner approval.**

## 4. Build pipeline to internal testing (authorized environment)

```bash
cd apps/mobile
bun install                      # resolves expo/react-native deps (needs network)
EXPO_PUBLIC_API_BASE=https://<gateway-host> bunx expo start   # dev on device via Expo Go
# one-time:
bunx eas-cli build:configure     # creates eas.json (or write profiles below)
bunx eas-cli credentials         # iOS credentials + Android keystore
# internal testing builds:
bunx eas-cli build --platform ios --profile preview     # → TestFlight via:
bunx eas-cli submit --platform ios --latest --group internal-testers
bunx eas-cli build --platform android --profile preview   # AAB →
bunx eas-cli submit --platform android --latest --track internal
```

Suggested `eas.json` profiles (create in authorized env):
- `development`: simulator/dev-client, `EXPO_PUBLIC_API_BASE` → staging gateway
- `preview`: internal distribution, release channel `internal`, env: API base, socket base
- `production`: store submission (NOT to be run without approval)

App identifiers to register: iOS `com.shopnest.app` (or owner's reverse-domain), Android same. Expo plugin config (camera, notifications) already present in `apps/mobile/app.json`.

## 5. Gate criteria before TestFlight / Play internal

1. `bunx tsc --noEmit` clean in `apps/mobile` **after `bun install`** (current diagnostics are all unresolvable-import errors from missing deps — recheck once installed).
2. `expo-doctor` passes; EAS build succeeds on `development` profile.
3. Manual device QA: login/register, household switch, list CRUD offline→sync, Shopping Mode finish flow, photo capture → confirmation round-trip, push permission prompt, backgrounding/foregrounding socket resume.
4. Cross-client check: web (Chromium/Safari) + mobile on the same household converge in ≤2s on mutations.
5. Backend hardening item (recommended before any external tester): authenticated socket `join` (SECURITY.md §6).

## 6. Explicit non-claims

- No `.ipa`/`.aab` artifact exists; `eas build` has never been run; no Apple/Google/Expo credentials exist.
- Native camera, notifications and voice have not been exercised on hardware.
- `apps/mobile/README.md` carries the same honesty section and per-screen completeness notes.
