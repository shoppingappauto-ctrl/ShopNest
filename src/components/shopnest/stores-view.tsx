'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Star,
  MapPin,
  Navigation,
  MoreHorizontal,
  Trash2,
  Pencil,
  Store as StoreIcon,
  Search,
  Info,
  ChevronDown,
  AlertTriangle,
  Receipt,
  Scale,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useStores,
  useCreateStore,
  useUpdateStore,
  useDeleteStore,
  useOutstanding,
  useLists,
  usePriceObservations,
  usePriceCompare,
  type PriceObservationT,
} from '@/lib/shopnest/hooks'
import { STORE_CATEGORIES, STORE_CATEGORY_EMOJI, WELL_KNOWN_STORES } from '@/lib/shopnest/constants'
import { formatCents, isPriceStale } from '@/lib/shopnest/money'
import { timeAgo } from '@/components/shopnest/ui-bits'
import type { Me, Store as StoreT, OutstandingGroup as OutstandingGroupT } from '@/lib/shopnest/types'

// ─── local view types ────────────────────────────────────────────────────────

/** Which store's outstanding items the drill-down dialog shows. */
type DetailTarget = { storeId: string; storeName: string; category: string }

/**
 * Shape of the price-observations API's `byProduct` summary (typed locally —
 * the hook declares it as `unknown[]`). Latest observation per store plus the
 * lowest ever-recorded total for that store.
 */
type ByProductStore = {
  storeId: string | null
  storeName: string
  latest: {
    totalPriceCents: number
    quantity: number
    unit: string
    unitPriceCents: number | null
    basis: string | null
    observedAt: string
    stale: boolean
    source: string
  }
  lowestTotalPriceCents: number
}
type ByProductGroup = {
  itemName: string
  nameBn: string | null
  productId: string | null
  stores: ByProductStore[]
}

/** Normalized per-store row used by both Price Memory modes (search + summary). */
type PriceStoreRow = {
  storeKey: string
  storeName: string
  latestCents: number
  quantity: number
  unit: string
  unitPriceCents: number | null
  basis: string | null
  observedAt: string
  source: string
}
type PriceProduct = { key: string; itemName: string; nameBn: string | null; rows: PriceStoreRow[] }

/** One ranked store row from the price-compare API. */
type CompareStoreRow = {
  storeId: string
  storeName: string
  estimatedTotalCents: number
  matched: number
  missingCount: number
  missing: string[]
  staleUsed: string[]
}

const SOURCE_LABELS: Record<string, string> = {
  USER_ENTERED: 'You entered',
  RETAILER_AUTHORIZED: 'Retailer-authorized',
  RECEIPT: 'Receipt',
  PARTNER_FEED: 'Partner feed',
  COMMUNITY: 'Community-reported',
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? 'Household-recorded'
}

const CATEGORY_OPTIONS = STORE_CATEGORIES.map((c) => ({ value: c, label: `${STORE_CATEGORY_EMOJI[c]} ${labelFor(c)}` }))

function labelFor(c: string): string {
  return c.charAt(0) + c.slice(1).toLowerCase().replace('_', ' ')
}

/**
 * The outstanding API groups ONLY by the item's own store; items without a
 * store arrive as storeId "none" / category OTHER. Render that group as
 * "Unassigned" with the OTHER emoji, exactly per the canonical rule.
 */
function groupLabel(g: OutstandingGroupT): { emoji: string; name: string } {
  if (g.storeId === 'none') return { emoji: STORE_CATEGORY_EMOJI.OTHER ?? '🏬', name: 'Unassigned' }
  return { emoji: STORE_CATEGORY_EMOJI[g.category] ?? '🏬', name: g.storeName }
}

export function StoresView({ householdId, me }: { householdId: string; me: Me }) {
  const storesQ = useStores(householdId)
  const createStore = useCreateStore(householdId)
  const updateStore = useUpdateStore(householdId)
  const deleteStore = useDeleteStore(householdId)
  const queryClient = useQueryClient()

  // Single outstanding data source shared by the section AND the drill-down
  // dialog, so a store's count and its item list can never diverge.
  const outQ = useOutstanding(householdId)
  // The hook types groups narrowly; the API actually returns the richer V2
  // shape (note, nameBn, estimatedPriceCents — see types.ts / outstanding route).
  const outstandingGroups = (outQ.data?.groups ?? []) as OutstandingGroupT[]

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('SUPERMARKET')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<StoreT | null>(null)
  const [editStore, setEditStore] = useState<StoreT | null>(null)
  const [detail, setDetail] = useState<DetailTarget | null>(null)

  const stores = storesQ.data?.stores ?? []
  const suggestions = WELL_KNOWN_STORES.filter(
    (s) => !stores.some((st) => st.name.toLowerCase() === s.toLowerCase())
  )

  const openStoreDetail = (t: DetailTarget) => {
    setDetail(t)
    // refresh outstanding so the drill-down always matches the card count
    queryClient.invalidateQueries({ queryKey: ['outstanding', householdId] })
  }

  const openNavigation = (s: StoreT) => {
    if (!s.address) {
      window.alert('No address saved for this store. Edit the store to add one.')
      return
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address + ' ' + s.name)}`, '_blank')
  }

  const submitCreate = () => {
    const n = name.trim()
    if (!n) return
    createStore.mutate(
      { name: n, category, address: address.trim() || null, notes: notes.trim() || null, isFavorite },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setName('')
          setAddress('')
          setNotes('')
          setIsFavorite(false)
        },
      }
    )
  }

  const submitEdit = () => {
    if (!editStore) return
    updateStore.mutate({
      id: editStore.id,
      patch: {
        name: editStore.name,
        category: editStore.category,
        address: editStore.address,
        notes: editStore.notes,
      },
    })
    setEditStore(null)
  }

  const detailGroup = detail ? outstandingGroups.find((g) => g.storeId === detail.storeId) : undefined
  const detailEmoji = !detail
    ? '🏬'
    : detail.storeId === 'none'
      ? (STORE_CATEGORY_EMOJI.OTHER ?? '🏬')
      : (STORE_CATEGORY_EMOJI[detail.category] ?? '🏬')

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground">Supermarkets, halal markets, Bangladeshi groceries, butchers and more.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 h-9 shrink-0">
          <Plus className="h-4 w-4" /> Add store
        </Button>
      </div>

      {/* Outstanding by store — canonical counts, items grouped by their own store */}
      <OutstandingByStore
        groups={outstandingGroups}
        isLoading={outQ.isLoading}
        onOpenStore={openStoreDetail}
      />

      {storesQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <StoreIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Add the stores your household shops at to organize lists by store.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add your first store
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stores.map((s) => {
            // CANONICAL count: stores API counts only PENDING items assigned to
            // this store (item.storeId == store) excluding archived lists — the
            // same rule as the outstanding groups above, so numbers always agree.
            const toBuy = s._count?.items ?? 0
            const listsCount = s._count?.lists ?? 0
            return (
              <Card key={s.id} className="py-0 overflow-hidden">
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => openStoreDetail({ storeId: s.id, storeName: s.name, category: s.category })}
                    className="min-w-0 flex-1 space-y-2 p-4 text-left transition-colors hover:bg-muted/50"
                    aria-label={`${s.name} — ${toBuy} to buy. View outstanding items.`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0" aria-hidden>{STORE_CATEGORY_EMOJI[s.category] ?? '🏬'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{s.name}</h3>
                          <Badge variant="outline" className="text-[10px] shrink-0">{labelFor(s.category)}</Badge>
                          {!s.verified && <Badge variant="secondary" className="text-[10px] shrink-0">user-added</Badge>}
                        </div>
                        {s.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{s.address}</span>
                          </p>
                        )}
                        {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                      </div>
                    </div>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px] tabular-nums">
                        {toBuy} to buy
                      </Badge>
                      <span className="text-muted-foreground">
                        {listsCount} list{listsCount === 1 ? '' : 's'}
                      </span>
                    </p>
                  </button>
                  <div className="flex items-start gap-1 p-2 shrink-0">
                    <button
                      onClick={() => updateStore.mutate({ id: s.id, patch: { isFavorite: !s.isFavorite } })}
                      aria-label={s.isFavorite ? 'Unfavorite store' : 'Favorite store'}
                      className="p-1.5"
                    >
                      <Star className={cn('h-[18px] w-[18px]', s.isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${s.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openNavigation(s)}>
                          <Navigation className="mr-2 h-4 w-4" /> Open in maps
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditStore({ ...s })}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(s)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Price Memory — household-recorded prices, searchable */}
      <PriceMemorySection householdId={householdId} />

      {/* Basket comparison — estimated basket per store for one active list */}
      <BasketCompareSection householdId={householdId} stores={stores} />

      {/* Store detail drill-down: same outstanding groups the counts come from */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span aria-hidden>{detailEmoji}</span>
              {detail?.storeName}
            </DialogTitle>
            <DialogDescription>
              Items still to buy here — same source as the “to buy” count on the card.
            </DialogDescription>
          </DialogHeader>
          {detailGroup && detailGroup.items.length > 0 ? (
            <>
              <div className="max-h-[50dvh] space-y-1.5 overflow-y-auto scrollbar-slim -mx-1 px-1">
                {detailGroup.items.map((it) => (
                  <div key={it.id} className="rounded-lg border bg-card/50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {it.name}
                        {it.nameBn && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{it.nameBn}</span>}
                      </p>
                      {it.estimatedPriceCents != null && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatCents(it.estimatedPriceCents)}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {it.quantity} {it.unit} · {it.listName}
                    </p>
                    {it.note && <p className="mt-1 text-xs italic text-muted-foreground">“{it.note}”</p>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {detailGroup.items.length} item{detailGroup.items.length === 1 ? '' : 's'} to buy here.
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <ListChecks className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nothing to buy at this store right now.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a store</DialogTitle>
            <DialogDescription>Store details are user-entered and marked as such — never shown as verified listings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Name</Label>
              <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Al Aqsa Halal Market" autoFocus />
            </div>
            {suggestions.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {suggestions.slice(0, 6).map((sg) => (
                  <button
                    key={sg}
                    className="rounded-full border px-2.5 py-1 text-xs hover:border-primary/60 hover:bg-primary/5"
                    onClick={() => setName(sg)}
                  >
                    {sg}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="st-category">Category</Label>
              <select id="st-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-address">Address (optional)</Label>
              <Input id="st-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-notes">Notes (optional)</Label>
              <Textarea id="st-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Best fish selection, open Sundays…" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="st-fav" className="text-sm">Save as favorite</Label>
              <Switch id="st-fav" checked={isFavorite} onCheckedChange={setIsFavorite} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={!name.trim() || createStore.isPending}>Add store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editStore} onOpenChange={(o) => !o && setEditStore(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit store</DialogTitle>
          </DialogHeader>
          {editStore && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ste-name">Name</Label>
                <Input id="ste-name" value={editStore.name} onChange={(e) => setEditStore({ ...editStore, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ste-category">Category</Label>
                <select
                  id="ste-category"
                  value={editStore.category}
                  onChange={(e) => setEditStore({ ...editStore, category: e.target.value })}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ste-address">Address</Label>
                <Input id="ste-address" value={editStore.address ?? ''} onChange={(e) => setEditStore({ ...editStore, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ste-notes">Notes</Label>
                <Textarea id="ste-notes" value={editStore.notes ?? ''} onChange={(e) => setEditStore({ ...editStore, notes: e.target.value })} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStore(null)}>Cancel</Button>
            <Button onClick={submitEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove “{deleteConfirm?.name}”?</DialogTitle>
            <DialogDescription>Items assigned to this store stay on their lists; they just lose the store tag.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) deleteStore.mutate({ id: deleteConfirm.id })
                setDeleteConfirm(null)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** “Outstanding by store” — one clickable row per store group incl. Unassigned. */
function OutstandingByStore({
  groups,
  isLoading,
  onOpenStore,
}: {
  groups: OutstandingGroupT[]
  isLoading: boolean
  onOpenStore: (t: DetailTarget) => void
}) {
  if (isLoading) return <Skeleton className="h-16" />
  if (groups.length === 0) return null

  return (
    <section aria-label="Outstanding by store" className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding by store</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => {
          const label = groupLabel(g)
          return (
            <button
              key={g.storeId}
              type="button"
              onClick={() => onOpenStore({ storeId: g.storeId, storeName: label.name, category: g.category })}
              className="rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
              aria-label={`${label.name} — ${g.items.length} to buy. View items.`}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden>{label.emoji}</span> {label.name}
                <Badge variant="secondary" className="ml-auto tabular-nums">{g.items.length}</Badge>
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {g.items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(' · ')}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─── Price Memory ────────────────────────────────────────────────────────────

/**
 * Price Memory browser.
 * - Search box filters via usePriceObservations(itemName=search).
 * - Empty search shows the API's per-product `byProduct` summary.
 * Always honest: household-recorded prices, never a live price feed.
 */
function PriceMemorySection({ householdId }: { householdId: string }) {
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')

  // debounce keystrokes before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim()), 300)
    return () => clearTimeout(t)
  }, [searchRaw])

  const obsQ = usePriceObservations(householdId, search || undefined)
  const products = buildProducts(search, obsQ.data)

  return (
    <section aria-label="Price Memory" className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price Memory</h2>
      <p className="text-[11px] text-muted-foreground -mt-1">Household-recorded prices — not a live price feed.</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          placeholder="Search recorded prices — e.g. hilsa, mustard oil…"
          className="pl-9"
          aria-label="Search recorded prices"
        />
      </div>
      {obsQ.isLoading ? (
        <Skeleton className="h-24" />
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <Receipt className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {search ? `No recorded prices for “${search}” yet.` : 'No prices recorded yet.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Save prices while you shop to build your household’s price memory.</p>
        </div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-slim -mx-1 px-1">
          {products.map((p) => (
            <PriceProductCard key={p.key} product={p} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Build the per-product price cards for both modes:
 * - search: group the searched observations by store (API returns them
 *   newest-first, so the first row seen per store is that store's latest).
 * - summary (empty search): use the API's per-product `byProduct` groups.
 */
function buildProducts(
  search: string,
  data: { observations: PriceObservationT[]; byProduct: unknown[] } | undefined
): PriceProduct[] {
  if (search) {
    const p = observationsToProduct(search, data?.observations ?? [])
    return p ? [p] : []
  }
  const byProduct = (data?.byProduct ?? []) as ByProductGroup[]
  return byProduct.map((g) => ({
    key: g.itemName.toLowerCase(),
    itemName: g.itemName,
    nameBn: g.nameBn,
    rows: g.stores.map((s) => ({
      storeKey: s.storeId ?? 'none',
      storeName: s.storeName,
      latestCents: s.latest.totalPriceCents,
      quantity: s.latest.quantity,
      unit: s.latest.unit,
      unitPriceCents: s.latest.unitPriceCents,
      basis: s.latest.basis,
      observedAt: s.latest.observedAt,
      source: s.latest.source,
    })),
  }))
}

/** Group searched observations by store into a single product card. */
function observationsToProduct(search: string, obs: PriceObservationT[]): PriceProduct | null {
  if (obs.length === 0) return null
  const rows = new Map<string, PriceStoreRow>()
  for (const o of obs) {
    const key = o.storeId ?? 'none'
    if (!rows.has(key)) {
      rows.set(key, {
        storeKey: key,
        storeName: o.store?.name ?? o.storeName ?? 'Unassigned store',
        latestCents: o.totalPriceCents,
        quantity: o.quantity,
        unit: o.unit,
        unitPriceCents: o.unitPriceCents,
        basis: o.unitPriceBasis,
        observedAt: o.observedAt,
        source: o.source,
      })
    }
  }
  return {
    key: search.toLowerCase(),
    itemName: obs[0]?.itemName ?? search,
    nameBn: obs[0]?.nameBn ?? null,
    rows: [...rows.values()],
  }
}

/** One product: per-store latest price, unit price, source, stale + lowest chips. */
function PriceProductCard({ product }: { product: PriceProduct }) {
  // "Lowest recorded" compares the displayed latest prices across stores, so
  // the chip always agrees with the number shown.
  const minLatest = product.rows.length > 1 ? Math.min(...product.rows.map((r) => r.latestCents)) : null

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">
          {product.itemName}
          {product.nameBn && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{product.nameBn}</span>}
        </p>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {product.rows.length} store{product.rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="space-y-1.5">
        {product.rows.map((r) => {
          const stale = isPriceStale(r.observedAt)
          const isLowest = minLatest !== null && r.latestCents === minLatest
          return (
            <div key={r.storeKey} className="space-y-1 rounded-lg border border-border/60 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium">{r.storeName}</p>
                <p className="shrink-0 text-sm font-bold tabular-nums">{formatCents(r.latestCents)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.unitPriceCents != null && r.basis && (
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    {formatCents(r.unitPriceCents)}/{r.basis}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">{sourceLabel(r.source)}</Badge>
                {isLowest && (
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">
                    Lowest recorded
                  </Badge>
                )}
                {stale && (
                  <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px]">
                    <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                    Price from {timeAgo(r.observedAt)} — may be outdated
                  </Badge>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Basket comparison ───────────────────────────────────────────────────────

/**
 * Pick an active list → price-compare API ranks stores by estimated basket
 * total from Price Memory. Only honest: matched/missing counts are shown,
 * missing items are never fabricated, and the API's honesty note is prominent.
 */
function BasketCompareSection({ householdId, stores }: { householdId: string; stores: StoreT[] }) {
  const listsQ = useLists(householdId)
  const activeLists = (listsQ.data?.lists ?? []).filter((l) => l.status === 'ACTIVE')
  const [chosenListId, setChosenListId] = useState('')
  // no explicit choice yet → default to the first active list (no effect needed)
  const listId = chosenListId || activeLists[0]?.id || ''

  const compareQ = usePriceCompare(householdId, listId || undefined)
  const rows = compareQ.data?.stores ?? []
  const note = compareQ.data?.note

  return (
    <section aria-label="Basket comparison" className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basket comparison</h2>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Compare an active list’s estimated basket across your stores, using recorded prices.
      </p>
      {activeLists.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No active lists to compare yet.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            value={listId}
            onChange={(e) => setChosenListId(e.target.value)}
            aria-label="Choose a list to compare"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
          >
            <option value="" disabled>Choose a list…</option>
            {activeLists.map((l) => (
              <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>
            ))}
          </select>

          {note && (
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p className="text-xs leading-relaxed text-foreground/90">{note}</p>
            </div>
          )}

          {!listId || compareQ.isLoading ? (
            <Skeleton className="h-24" />
          ) : compareQ.isError ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Couldn’t load the comparison for this list.
            </p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <Scale className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Not enough price data yet — save prices while you shop.</p>
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-slim -mx-1 px-1">
              {rows.map((row, i) => (
                <BasketRow
                  key={row.storeId}
                  row={row}
                  rank={i}
                  isFavorite={stores.find((s) => s.id === row.storeId)?.isFavorite ?? false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** One ranked store estimate with matched/missing counts and honest chips. */
function BasketRow({ row, rank, isFavorite }: { row: CompareStoreRow; rank: number; isFavorite: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-card p-3', rank === 0 && 'border-primary/40')}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
          {isFavorite && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label="favorite store" />}
          <span className="truncate">{row.storeName}</span>
        </p>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums">{formatCents(row.estimatedTotalCents)}</p>
          <p className="text-[10px] text-muted-foreground">estimated total</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {rank === 0 && (
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">
            Best estimate
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] tabular-nums">{row.matched} priced</Badge>
        {row.missingCount > 0 && (
          <Badge variant="outline" className="text-[10px] tabular-nums">{row.missingCount} missing</Badge>
        )}
        {row.staleUsed.length > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px]"
            title={`Stale prices used for: ${row.staleUsed.join(', ')}`}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            {row.staleUsed.length} stale price{row.staleUsed.length === 1 ? '' : 's'} used
          </Badge>
        )}
      </div>
      {row.missing.length > 0 && (
        <Collapsible className="mt-2">
          <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            Missing items ({row.missingCount})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-1.5 space-y-1 border-l-2 border-border/60 pl-3">
              {row.missing.map((m, idx) => (
                <li key={idx} className="text-xs text-muted-foreground">{m}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
