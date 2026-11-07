/**
 * Root layout: providers + auth gate.
 *
 * Wraps every screen in:
 *  • SafeAreaProvider (handles notches + home indicator)
 *  • QueryClientProvider (TanStack Query)
 *  • AuthProvider (secure-store session)
 *  • StatusBar (ShopNest green)
 *
 * If the user is not authenticated (no token / me=null), the root layout
 * renders the auth screens (`/login`, `/register`). Otherwise it renders the
 * `(tabs)` group + detail routes.
 */

import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuth, AuthProvider } from '../lib/auth'
import { configureNotifications, registerForPushNotifications } from '../lib/notifications'
import { refreshSession } from '../lib/api-client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false, // RN has no window focus event — realtime covers it
    },
  },
})

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, households } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  // Sliding session refresh — extends the TTL once per app start.
  useEffect(() => {
    refreshSession()
  }, [])

  // Configure local notifications once.
  useEffect(() => {
    configureNotifications()
  }, [])

  // Request push token once the user is authed (best-effort).
  useEffect(() => {
    if (user) {
      registerForPushNotifications().catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (loading) return
    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'login' || segments[0] === 'register'

    if (!user && !inAuthGroup) {
      router.replace('/login')
    } else if (user && inAuthGroup) {
      // Authed but on a login/register route → go to the first tab.
      router.replace('/')
    } else if (user && households.length === 0 && segments[0] !== '(tabs)' && segments[0] !== 'household-setup') {
      // No household → send to setup (handled in the household tab screen).
      // Don't hard-redirect here so deep links still work; the household tab
      // itself shows a setup screen when activeHousehold is null.
    }
  }, [user, loading, segments, router])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" backgroundColor="#ffffff" />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#ffffff' },
                }}
              >
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="list/[id]"
                  options={{ headerShown: true, title: 'List', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="shopping-mode/[sessionId]"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="confirmations"
                  options={{ headerShown: true, title: 'Confirmations', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="pantry"
                  options={{ headerShown: true, title: 'Pantry', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="budgets"
                  options={{ headerShown: true, title: 'Budgets', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="price-memory"
                  options={{ headerShown: true, title: 'Price memory', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="catalog"
                  options={{ headerShown: true, title: 'Catalog', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="event/[id]"
                  options={{ headerShown: true, title: 'Event', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ headerShown: true, title: 'Settings', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="add-item"
                  options={{ headerShown: true, title: 'Add item', headerBackTitle: 'Back', presentation: 'modal' }}
                />
              </Stack>
            </AuthGate>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
