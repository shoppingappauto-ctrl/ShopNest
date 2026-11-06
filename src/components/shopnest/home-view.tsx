'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Star, CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { useLists, useStores, useProducts, useAddItem, useCreateList, useHousehold, useEvents } from '@/lib/shopnest/hooks'
import { CATEGORY_EMOJI, STORE_CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import { ActivityFeed } from '@/components/shopnest/activity-feed'
import { UserChip, timeAgo } from '@/components/shopnest/ui-bits'
import type { Tab } from '@/components/shopnest/app-shell'
import type { Me } from '@/lib/shopnest/types'

type Props = {
  householdId: string
  me: Me
  onOpenTab: (tab: Tab) => void
}

export function HomeView({ householdId, me, onOpenTab }: Props) {
  const listsQ = useLists(householdId)
  const storesQ = useStores(householdId)
  const productsQ = useProducts(householdId)
  const householdQ = useHousehold(householdId)
  const addItem = useAddItem(householdId)
  const createList = useCreateList(householdId)

  const lists = listsQ.data?.lists ?? []
  const stores = storesQ.data?.stores ?? []
  const products = productsQ.data?.products ?? []
  const members = householdQ.data?.household.members ?? []

  const activeLists = lists.filter((l) => l.status === 'ACTIVE')
  const totalOutstanding = lists.reduce((acc, l) => acc + (l.counts?.pending ?? 0), 0)

  const [lastListId, setLastListId] = useState<string | null>(null)
  const targetList = lists.find((l) => l.id === lastListId) ?? activeLists[0] ?? null

  const quickAdd = (productId: { id: string; name: string; nameBn?: string | null; category: string; defaultQty: number; unit: string; storeId?: string | null }) => {
    if (!targetList) return
    addItem.mutate(
      {
        listId: targetList.id,
        name: productId.name,
        nameBn: productId.nameBn ?? null,
        quantity: productId.defaultQty,
        unit: productId.unit,
        category: productId.category,
        storeId: productId.storeId ?? null,
        favoriteProductId: productId.id,
      },
      { onSuccess: () => setLastListId(targetList.id) }
    )
  }

  const createFirstList = () => {
    createList.mutate({ name: 'Groceries', emoji: '🛒' })
  }

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4">
      {/* Greeting */}
      <section aria-label="Overview">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hi {me.name.split(' ')[0]} 👋</h1>
            <p className="text-sm text-muted-foreground">
              {totalOutstanding > 0
                ? `${totalOutstanding} item${totalOutstanding === 1 ? '' : 's'} to pick up across ${activeLists.length} list${activeLists.length === 1 ? '' : 's'}.`
                : 'Everything is picked up — nice work!'}
            </p>
          </div>
          <div className="flex -space-x-2" aria-label={`${members.length} household members`}>
            {members.slice(0, 5).map((m) => (
              <UserChip key={m.id} name={m.user.name} color={m.user.avatarColor} size={30} className="ring-2 ring-background" />
            ))}
          </div>
        </div>
      </section>

      {/* Lists */}
      <section aria-label="Shopping lists" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shopping lists</h2>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => onOpenTab('lists')}>
            All lists <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {listsQ.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : activeLists.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No active lists yet. Create your first shared list.</p>
              <Button size="sm" onClick={createFirstList} disabled={createList.isPending}>
                <Plus className="mr-1 h-4 w-4" /> Create list
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {activeLists.slice(0, 4).map((l) => (
              <Card
                key={l.id}
                className="cursor-pointer hover:border-primary/50 transition-colors py-0"
                onClick={() => onOpenTab('lists')}
              >
                <CardContent className="flex items-center gap-3 p-3.5">
                  <span className="text-2xl" aria-hidden>{l.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.store ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {l.store.name}
                        </span>
                      ) : (
                        'No store selected'
                      )}
                    </p>
                  </div>
                  <Badge variant={l.counts?.pending ? 'default' : 'secondary'} className="shrink-0">
                    {l.counts?.pending ?? 0} left
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Essentials (favorites & recurring) */}
      <section aria-label="Household essentials" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Essentials — one-tap re-add</h2>
        </div>
        {productsQ.isLoading ? (
          <Skeleton className="h-14" />
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-5 text-sm text-muted-foreground text-center">
              Save favorites like milk, bread or halal chicken and re-add them in one tap.
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-slim">
            {products.slice(0, 12).map((p) => (
              <button
                key={p.id}
                onClick={() => quickAdd(p)}
                disabled={!targetList || addItem.isPending}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/60 hover:bg-primary/5 transition-colors disabled:opacity-50"
                title={targetList ? `Add to ${targetList.name}` : 'Create a list first'}
              >
                <span aria-hidden>{CATEGORY_EMOJI[p.category] ?? '🛒'}</span>
                <span className="max-w-36 truncate">{p.name}</span>
                {p.isRecurring && <Star className="h-3 w-3 text-primary fill-primary" aria-label="recurring" />}
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        {targetList && (
          <p className="text-xs text-muted-foreground">
            Quick add goes to <span className="font-medium text-foreground">{targetList.name}</span>
          </p>
        )}
      </section>

      {/* Favorite stores */}
      <section aria-label="Favorite stores" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Favorite stores</h2>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => onOpenTab('stores')}>
            All stores <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {storesQ.isLoading ? (
          <Skeleton className="h-14" />
        ) : (
          <div className="flex gap-2 flex-wrap">
            {stores.filter((s) => s.isFavorite).slice(0, 6).map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm">
                <span aria-hidden>{STORE_CATEGORY_EMOJI[s.category] ?? '🏬'}</span>
                {s.name}
              </span>
            ))}
            {stores.filter((s) => s.isFavorite).length === 0 && (
              <p className="text-sm text-muted-foreground">No favorites yet — star stores you shop often.</p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Household activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed householdId={householdId} maxHeight="h-64" />
          </CardContent>
        </Card>

        {/* Recurring due + upcoming */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> Reminders & upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {products
              .filter((p) => p.isRecurring && p.lastPurchasedAt && p.recurrenceDays)
              .filter((p) => {
                const due = new Date(p.lastPurchasedAt!).getTime() + (p.recurrenceDays ?? 0) * 86400_000
                return due <= Date.now() + 86400_000
              })
              .slice(0, 4)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span aria-hidden className="mr-1">{CATEGORY_EMOJI[p.category] ?? '🛒'}</span>
                    {p.name} is due
                    <span className="text-muted-foreground"> · every {p.recurrenceDays}d</span>
                  </span>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => quickAdd(p)} disabled={!targetList}>
                    <Plus className="h-3 w-3" /> Re-add
                  </Button>
                </div>
              ))}
            {products.filter((p) => p.isRecurring && p.lastPurchasedAt && p.recurrenceDays).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Mark essentials as recurring to get gentle “due for a refill” reminders here.
              </p>
            )}
            <UpcomingEventsMini householdId={householdId} />
            <p className="text-xs text-muted-foreground">
              Updated {timeAgo(listsQ.dataUpdatedAt || new Date().toISOString())}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function UpcomingEventsMini({ householdId }: { householdId: string }) {
  const eventsQ = useEvents(householdId)
  const events = (eventsQ.data?.events ?? []).filter((e) => e.status === 'PLANNING' && e.date).slice(0, 3)
  if (events.length === 0) return null
  return (
    <div className="space-y-1.5 border-t pt-3">
      {events.map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-sm">
          <span aria-hidden>📅</span>
          <span className="truncate font-medium">{e.name}</span>
          <span className="text-muted-foreground ml-auto shrink-0">
            {new Date(e.date!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  )
}
