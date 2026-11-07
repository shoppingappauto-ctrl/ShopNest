/**
 * ShopNest Mobile — local notifications on realtime events.
 *
 * `expo-notifications` can present local notifications on the device without
 * any server-side push infrastructure. We use this to surface:
 *  • a new "Ask Family" confirmation request lands
 *  • a family member just purchased an item
 *
 * Push server (APNs/FCM credentials + a server-side dispatch) is NOT yet
 * wired — this is documented in apps/mobile/README.md "Status & honesty".
 */

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

let configured = false

/** Configure the notification handler (idempotent). Call once on app start. */
export function configureNotifications(): void {
  if (configured) return
  configured = true
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

/** Request permission and return an Expo push token (or null if denied). */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null
  try {
    const current = await Notifications.getPermissionsAsync()
    let status = current.status
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') return null

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'replace-with-your-eas-project-id',
    })).data

    // Android needs a channel for local notifications to show.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('shopnest', {
        name: 'ShopNest',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#16a34a',
      })
    }
    return token
  } catch {
    return null
  }
}

/** Show a local notification immediately. No-op if the platform can't. */
export async function showLocalNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        color: '#16a34a',
      },
      trigger: null, // immediately
    })
  } catch {
    // Backgrounded / no permissions — swallow silently.
  }
}
