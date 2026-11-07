/**
 * ShopNest Mobile — secure credential storage.
 *
 * The session token is the only long-lived credential the native app holds.
 * It MUST live in the OS Keychain (iOS) / Keystore (Android) via
 * `expo-secure-store` — never in AsyncStorage, never in plaintext file storage.
 *
 * Per SECURITY.md §1: "The same opaque token is stored in the OS Keychain/
 * Keystore via expo-secure-store (apps/mobile), never in JS-accessible web
 * storage."
 *
 * The active household id is also user-scoped session state — kept here for
 * consistency (low-sensitivity, but convenient to colocate).
 */

import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'shopnest_token'
const ACTIVE_HOUSEHOLD_KEY = 'shopnest_active_household'

/** Read the bearer token from the secure store. Returns null if absent. */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Persist the bearer token securely. Pass null to clear. */
export async function setToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      })
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    }
  } catch {
    // Graceful: SecureStore may be unavailable in Expo Go on certain Android
    // emulators — callers should treat missing token as logged-out.
  }
}

export async function getActiveHouseholdId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACTIVE_HOUSEHOLD_KEY)
  } catch {
    return null
  }
}

export async function setActiveHouseholdId(id: string | null): Promise<void> {
  try {
    if (id) await SecureStore.setItemAsync(ACTIVE_HOUSEHOLD_KEY, id)
    else await SecureStore.deleteItemAsync(ACTIVE_HOUSEHOLD_KEY)
  } catch {
    // ignore
  }
}
