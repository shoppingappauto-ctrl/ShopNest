'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useMe, qk } from '@/lib/shopnest/hooks'
import { migrateLegacyToken, refreshSession } from '@/lib/shopnest/client'
import { AuthScreen } from '@/components/shopnest/auth-screen'
import { AppShell } from '@/components/shopnest/app-shell'

export default function Page() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 },
          // mutations must always run so the ShopNest offline queue
          // (localStorage + auto-flush on reconnect) can handle them
          mutations: { networkMode: 'always' },
        },
      })
  )

  // One-time auth housekeeping on app load:
  //  1. migrate any legacy localStorage session token to the new
  //     sessionStorage/cookie strategy,
  //  2. sliding-refresh the session TTL if it is near expiry.
  useEffect(() => {
    migrateLegacyToken()
    refreshSession().finally(() => queryClient.invalidateQueries({ queryKey: qk.me }))
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <ShopNest />
    </QueryClientProvider>
  )
}

function ShopNest() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useMe()
  const authed = !!data?.user

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="12" className="fill-primary/60" />
          </svg>
          <p className="text-sm">Loading ShopNest…</p>
        </div>
      </div>
    )
  }

  return authed ? (
    <AppShell />
  ) : (
    <AuthScreen
      onAuthed={() => {
        // re-fetch /api/auth/me — the session now lives in the HttpOnly cookie
        // (same-site web) or sessionStorage Bearer fallback (cross-origin iframe)
        queryClient.invalidateQueries({ queryKey: qk.me })
      }}
    />
  )
}
