'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Home, ListChecks, Store, CalendarDays, Users, ShieldCheck, Moon, Sun, LogOut, ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMe, useLogout } from '@/lib/shopnest/hooks'
import { useRealtime } from '@/lib/shopnest/realtime'
import { ShopNestLogo } from '@/components/shopnest/logo'
import { SyncStatus } from '@/components/shopnest/sync-status'
import { HomeView } from '@/components/shopnest/home-view'
import { ListsView } from '@/components/shopnest/lists-view'
import { StoresView } from '@/components/shopnest/stores-view'
import { PlannerView } from '@/components/shopnest/planner-view'
import { HouseholdView } from '@/components/shopnest/household-view'
import { AdminView } from '@/components/shopnest/admin-view'

export type Tab = 'home' | 'lists' | 'stores' | 'planner' | 'household' | 'admin'

const TABS: { id: Tab; label: string; icon: typeof Home; mobile: boolean }[] = [
  { id: 'home', label: 'Home', icon: Home, mobile: true },
  { id: 'lists', label: 'Lists', icon: ListChecks, mobile: true },
  { id: 'stores', label: 'Stores', icon: Store, mobile: true },
  { id: 'planner', label: 'Planner', icon: CalendarDays, mobile: true },
  { id: 'household', label: 'Household', icon: Users, mobile: true },
]

const HH_KEY = 'shopnest_active_household'

export function AppShell() {
  const { data: meData, isLoading } = useMe()
  const logout = useLogout()
  const { resolvedTheme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('home')

  const me = meData?.user ?? null
  const households = useMemo(() => meData?.households ?? [], [meData])

  // active household: lazy-init from localStorage (client render only — the
  // loading gate means this component's meaningful output is client-side)
  const [savedHouseholdId, setSavedHouseholdId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(HH_KEY) : null
  )
  const householdId = savedHouseholdId && households.some((h) => h.id === savedHouseholdId)
    ? savedHouseholdId
    : households[0]?.id ?? null

  const switchHousehold = (id: string) => {
    setSavedHouseholdId(id)
    window.localStorage.setItem(HH_KEY, id)
  }

  const myHouseholds = households
  useRealtime(
    myHouseholds.map((h) => h.id),
    !!me
  )

  const currentHousehold = households.find((h) => h.id === householdId) ?? null

  if (isLoading || (!me && households.length === 0 && meData === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground">
          <ShopNestLogo size={44} className="opacity-80" />
          <p className="text-sm">Loading ShopNest…</p>
        </div>
      </div>
    )
  }

  if (!me) return null

  const initials = me.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const navItem = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      onClick={() => setTab(t.id)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
        tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      aria-current={tab === t.id ? 'page' : undefined}
    >
      <t.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      {t.label}
    </button>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 h-14 flex items-center gap-2 sm:gap-3">
          <button className="flex items-center gap-2 shrink-0" onClick={() => setTab('home')} aria-label="ShopNest home">
            <ShopNestLogo size={30} />
            <span className="font-bold text-lg tracking-tight hidden sm:inline">ShopNest</span>
          </button>

          {/* Household switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-[44vw] sm:max-w-56 gap-1.5 font-medium" aria-label="Switch household">
                <span className="truncate">{currentHousehold?.name ?? 'No household'}</span>
                {currentHousehold?.plan === 'PLUS' && (
                  <span className="rounded bg-primary/15 px-1 text-[10px] font-bold text-primary">PLUS</span>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Your households</DropdownMenuLabel>
              {myHouseholds.map((h) => (
                <DropdownMenuItem key={h.id} onClick={() => switchHousehold(h.id)} className="gap-2">
                  <span className={cn('h-2 w-2 rounded-full', h.id === householdId ? 'bg-primary' : 'bg-transparent border')} />
                  <span className="truncate">{h.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{h.role.toLowerCase()}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTab('household')} className="gap-2">
                <Plus className="h-4 w-4" /> Create or join household
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <SyncStatus />
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    aria-label="Toggle dark mode"
                  >
                    {resolvedTheme === 'dark' ? (
                      <Sun className="h-[18px] w-[18px]" />
                    ) : (
                      <Moon className="h-[18px] w-[18px]" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Light / dark</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-ring" aria-label="Account menu">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback style={{ backgroundColor: me.avatarColor }} className="text-white text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{me.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{me.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTab('household')}>
                  <Users className="mr-2 h-4 w-4" /> Household & settings
                </DropdownMenuItem>
                {me.isAdmin && (
                  <DropdownMenuItem onClick={() => setTab('admin')}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Admin portal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    logout.mutate(undefined, {
                      onSuccess: () => {
                        window.location.reload()
                      },
                    })
                  }
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl w-full px-0 sm:px-5 flex flex-1">
        {/* Desktop sidebar */}
        <nav className="hidden sm:flex flex-col gap-1 w-52 shrink-0 py-5 pr-4 sticky top-14 self-start" aria-label="Main">
          {TABS.map(navItem)}
          {me.isAdmin && (
            <button
              onClick={() => setTab('admin')}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab === 'admin' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <ShieldCheck className="h-[18px] w-[18px]" /> Admin portal
            </button>
          )}
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-safe-nav sm:py-5">
          {!currentHousehold ? (
            <HouseholdView tab={tab} setTab={setTab} needsHousehold />
          ) : tab === 'home' ? (
            <HomeView householdId={currentHousehold.id} me={me} onOpenTab={setTab} />
          ) : tab === 'lists' ? (
            <ListsView householdId={currentHousehold.id} me={me} />
          ) : tab === 'stores' ? (
            <StoresView householdId={currentHousehold.id} me={me} />
          ) : tab === 'planner' ? (
            <PlannerView householdId={currentHousehold.id} me={me} />
          ) : tab === 'admin' && me.isAdmin ? (
            <AdminView />
          ) : (
            <HouseholdView tab={tab} setTab={setTab} />
          )}

          {/* Footer */}
          <footer className="mt-auto border-t sm:mt-8">
            <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1.5">
              <p>ShopNest — Your Family. Your Shopping. One Place.</p>
              <p>
                Payments are disabled in this build · Support: support@shopnest.app · v1.0.0-MVP
              </p>
            </div>
          </footer>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {TABS.filter((t) => t.mobile).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium min-h-[52px] transition-colors',
                tab === t.id ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
