'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Star, CalendarDays, ChevronRight, MapPin, ShoppingBasket, Camera, AlertCircle } from 'lucide-react'
import { useLists, useStores, useProducts, useAddItem, useCreateList, useHousehold, useEvents, usePantry, useConfirmations, useAddPantryItem, useUpdatePantryItem } from '@/lib/shopnest/hooks'
import { CATEGORY_EMOJI, STORE_CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import { ActivityFeed } from '@/components/shopnest/activity-feed'
import { UserChip, timeAgo } from '@/components/shopnest/ui-bits'
import type { Tab } from '@/components/shopnest/app-shell'
import type { Me } from '@/lib/shopnest/types'

type Props = {
  householdId: string
  me: Me
  onOpenTab: (tab: Tab) => void
  onStartShopping: (listId?: string | null) => void
}

export function HomeView({ householdId, me, onOpenTab, onStartShopping }: Props) {
  const listsQ = useLists(householdId)
  const storesQ = useStores(householdId)
  const productsQ = useProducts(householdId)
  const householdQ = useHousehold(householdId)
  const addItem = useAddItem(householdId)
  const createList = useCreateList(householdId)
  const pantryQ = usePantry(householdId)
  const addPantry = useAddPantryItem(householdId)
  const updatePantry = useUpdatePantryItem(householdId)
  const confirmationsQ = useConfirmations(householdId, 'PENDING')
  const pendingConfirmations = (confirmationsQ.data?.requests ?? []).filter((r) => r.requestedBy?.id !== me.id)

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

      {/* Start Shopping — primary action */}
      <section aria-label="Start shopping">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold gap-2 shadow-sm"
          onClick={() => onStartShopping(targetList?.id ?? null)}
          disabled={totalOutstanding === 0}
        >
          <ShoppingBasket className="h-5 w-5" />
          Start Shopping
          {totalOutstanding > 0 && <span className="ml-1 opacity-80">· {totalOutstanding} left</span>}
        </Button>
        {totalOutstanding === 0 && (
          <p className="text-xs text-muted-foreground mt-1.5 text-center">Add items to a list to start shopping.</p>
        )}
      </section>

      {/* Family confirmations waiting */}
      {pendingConfirmations.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 py-0">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4 text-amber-600" /> Family needs your response ({pendingConfirmations.length})
            </p>
            {pendingConfirmations.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
                {r.photo ? (
                  <img src={r.photo.dataUrl} alt="Confirmation photo" className="h-11 w-11 rounded-md object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-muted" aria-hidden>❓</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.item?.name ?? 'Item'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.requestedBy?.name ?? 'Someone'} is asking{r.note ? `: “${r.note}”` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => onOpenTab('lists')}>
                  Respond
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      {/* Pantry — simple household stock (Feature Six) */}
      <PantrySection
        householdId={householdId}
        pantryQ={pantryQ}
        addPantry={addPantry}
        updatePantry={updatePantry}
        adding={addItem.isPending}
        onAddToList={(name, category) => {
          if (!targetList) return
          addItem.mutate(
            { listId: targetList.id, name, quantity: 1, unit: 'pc', category },
            { onSuccess: () => setLastListId(targetList.id) }
          )
        }}
      />

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

// ─── Pantry (Feature Six — simple, non-blocking) ─────────────────────────────

const PANTRY_STATUS_META: Record<string, { label: string; cls: string; emoji: string }> = {
  IN_STOCK: { label: 'In stock', cls: 'bg-primary/10 text-primary border-primary/30', emoji: '✅' },
  RUNNING_LOW: { label: 'Running low', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', emoji: '🟡' },
  OUT_OF_STOCK: { label: 'Out', cls: 'bg-destructive/10 text-destructive border-destructive/30', emoji: '🔴' },
  UNKNOWN: { label: 'Unknown', cls: 'bg-muted text-muted-foreground border-border', emoji: '❔' },
}

function PantrySection({
  householdId,
  pantryQ,
  addPantry,
  updatePantry,
  onAddToList,
  adding,
}: {
  householdId: string
  pantryQ: ReturnType<typeof usePantry>
  addPantry: ReturnType<typeof useAddPantryItem>
  updatePantry: ReturnType<typeof useUpdatePantryItem>
  onAddToList: (name: string, category: string) => void
  adding?: boolean
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('IN_STOCK')
  const items = pantryQ.data?.items ?? []
  const lowItems = items.filter((i) => i.status === 'RUNNING_LOW' || i.status === 'OUT_OF_STOCK')

  return (
    <section aria-label="Household pantry" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pantry</h2>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Close' : <><Plus className="h-4 w-4" /> Add item</>}
        </Button>
      </div>

      {showAdd && (
        <Card className="py-0">
          <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rice, cooking oil, diapers"
              className="flex-1 h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Pantry item name"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-md border bg-background px-2 text-sm"
              aria-label="Pantry status"
            >
              {Object.entries(PANTRY_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              className="h-10"
              disabled={!name.trim() || addPantry.isPending}
              onClick={() =>
                addPantry.mutate(
                  { name: name.trim(), status, category: 'OTHER' },
                  {
                    onSuccess: () => {
                      setName('')
                      setShowAdd(false)
                    },
                  }
                )
              }
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {pantryQ.isLoading ? (
        <Skeleton className="h-14" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground text-center">
            Track what you already have at home so you don't buy it twice.
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-slim">
          {lowItems.concat(items.filter((i) => i.status !== 'RUNNING_LOW' && i.status !== 'OUT_OF_STOCK')).slice(0, 14).map((item) => {
            const meta = PANTRY_STATUS_META[item.status] ?? PANTRY_STATUS_META.UNKNOWN
            return (
              <div key={item.id} className="shrink-0 rounded-xl border bg-card p-2.5 w-40 space-y-1.5">
                <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                  {meta.emoji} {meta.label}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    disabled={updatePantry.isPending}
                    onClick={() =>
                      updatePantry.mutate({
                        id: item.id,
                        status: item.status === 'IN_STOCK' ? 'RUNNING_LOW' : 'IN_STOCK',
                      })
                    }
                  >
                    {item.status === 'IN_STOCK' ? 'Running low' : 'Restocked'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 flex-1 text-xs text-primary"
                    disabled={adding}
                    title="Add to the current target list"
                    onClick={() => onAddToList(item.name, item.category)}
                  >
                    <Plus className="h-3 w-3" /> List
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
