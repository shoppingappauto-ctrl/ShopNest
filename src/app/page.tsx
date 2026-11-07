'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useMe, qk } from '@/lib/shopnest/hooks'
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
        // re-fetch /api/auth/me — the session now also lives in localStorage
        // (Bearer token), so this works even if cookies are blocked
        queryClient.invalidateQueries({ queryKey: qk.me })
      }}
    />
  )
}
