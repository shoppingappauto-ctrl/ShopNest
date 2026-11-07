'use client'

/**
 * Shopping Mode — full-screen, distraction-free trip companion.
 *
 * Mounts as a fixed overlay from the AppShell. Starts a ShoppingSession on
 * mount, lets the shopper tick items off store-by-store, ask the family for
 * photo confirmations, and finishes with a server-computed trip summary.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToastAction } from '@/components/ui/toast'
import {
  ArrowLeft,
  Camera,
  Check,
  CircleOff,
  HelpCircle,
  Hourglass,
  Loader2,
  MapPin,
  Minus,
  MoreVertical,
  Plus,
  Repeat,
  Send,
  StickyNote,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  useAddItem,
  useAskFamily,
  useBudgets,
  useConfirmations,
  useFinishShoppingSession,
  useList,
  useLists,
  useOutstanding,
  useStartShoppingSession,
  useStores,
  useUpdateItem,
  type ConfirmationRequestT,
} from '@/lib/shopnest/hooks'
import { compressImageFile } from '@/lib/shopnest/compress'
import { formatCents } from '@/lib/shopnest/money'
import { STORE_CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import type {
  OutstandingGroup as OutstandingGroupT,
  ShoppingItem,
  ShoppingSessionT,
  Store,
} from '@/lib/shopnest/types'
import { timeAgo } from '@/components/shopnest/ui-bits'

// The hooks file declares a narrower OutstandingGroup than the API returns;
// the V2 shape in types.ts matches the actual response (prices, notes, Bangla
// names), so we cast to that.
type OutGroup = OutstandingGroupT
type OutItem = OutGroup['items'][number]

/** ShoppingItem as stored in the DB — includes the price columns. */
type PricedItem = ShoppingItem & {
  actualPriceCents?: number | null
  estimatedPriceCents?: number | null
}

type SnapshotPurchased = {
  id: string
  name: string
  quantity?: number
  unit?: string
  priceCents?: number | null
}
type SessionSummary = {
  purchased?: SnapshotPurchased[]
  unavailable?: { id: string; name: string }[]
  remaining?: { id: string; name: string }[]
}

const NONE_STORE = 'none'
const DECIDED_STATUSES = ['APPROVED', 'REJECTED', 'SUBSTITUTE_SUGGESTED'] as const

export function ShoppingMode({
  householdId,
  initialListId,
  onClose,
}: {
  householdId: string
  initialListId?: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()

  // ─── data ────────────────────────────────────────────────────────────────
  const outstandingQ = useOutstanding(householdId)
  const storesQ = useStores(householdId)
  const listsQ = useLists(householdId)
  const pendingConfQ = useConfirmations(householdId, 'PENDING')
  const allConfQ = useConfirmations(householdId)
  const budgetsQ = useBudgets(householdId)

  // ─── mutations ───────────────────────────────────────────────────────────
  const startSession = useStartShoppingSession(householdId)
  const finishSession = useFinishShoppingSession(householdId)
  const updateItem = useUpdateItem(householdId)
  const addItem = useAddItem(householdId)

  // ─── state ───────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ session: ShoppingSessionT; data: SessionSummary } | null>(null)
  const [selectedStore, setSelectedStore] = useState<string>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [moveTarget, setMoveTarget] = useState<{ item: OutItem; storeId: string } | null>(null)
  const [askTarget, setAskTarget] = useState<OutItem | null>(null)

  const groups = useMemo(
    () => (outstandingQ.data?.groups ?? []) as unknown as OutGroup[],
    [outstandingQ.data]
  )
  const stores = storesQ.data?.stores ?? []

  // ─── active store chip: derived default + user override ───────────────
  // Default is the list's store, else the first store with items. A chip tap
  // sets `storeTouched` so the default stops overriding the user's choice.
  const [storeTouched, setStoreTouched] = useState(false)
  const defaultStore = useMemo(() => {
    if (!outstandingQ.data) return 'all'
    if (initialListId) {
      const list = listsQ.data?.lists.find((l) => l.id === initialListId)
      if (list?.storeId && groups.some((g) => g.storeId === list.storeId)) return list.storeId
    }
    const first =
      groups.find((g) => g.storeId !== NONE_STORE && g.items.length > 0) ??
      groups.find((g) => g.items.length > 0)
    return first?.storeId ?? 'all'
  }, [outstandingQ.data, groups, listsQ.data, initialListId])
  const activeStore = storeTouched ? selectedStore : defaultStore
  const pickStore = (id: string) => {
    setStoreTouched(true)
    setSelectedStore(id)
  }

  /** Groups visible under the current store filter. */
  const visibleGroups = useMemo(
    () => (activeStore === 'all' ? groups : groups.filter((g) => g.storeId === activeStore)),
    [groups, activeStore]
  )
  const remainingCount = useMemo(
    () => visibleGroups.reduce((n, g) => n + g.items.length, 0),
    [visibleGroups]
  )
  const totalCount = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups])

  // ─── session lifecycle (StrictMode-safe: start exactly once) ─────────────
  const startOnceRef = useRef(false)
  const startOrRetry = () => {
    startSession.mutate(
      { listId: initialListId ?? null },
      { onSuccess: (data) => setSessionId(data.session.id) }
    )
  }
  useEffect(() => {
    if (startOnceRef.current) return
    startOnceRef.current = true
    startOrRetry()
  }, [])

  // Lock background scroll while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ─── progress baseline: outstanding counts captured on first load ────────
  // Frozen once (async so the capture never cascades into the loading render):
  // progress = items no longer outstanding / items outstanding when the trip began.
  const [initialCounts, setInitialCounts] = useState<{ byStore: Map<string, number>; total: number } | null>(null)
  useEffect(() => {
    if (!outstandingQ.data) return
    const t = window.setTimeout(() => {
      setInitialCounts((prev) => {
        if (prev) return prev
        const byStore = new Map<string, number>()
        let total = 0
        for (const g of groups) {
          byStore.set(g.storeId, g.items.length)
          total += g.items.length
        }
        return { byStore, total }
      })
    }, 0)
    return () => window.clearTimeout(t)
  }, [outstandingQ.data, groups])

  const scopeInitial = activeStore === 'all'
    ? (initialCounts?.total ?? 0)
    : (initialCounts?.byStore.get(activeStore) ?? 0)
  const doneCount = Math.max(0, scopeInitial - remainingCount)
  const progressPct = scopeInitial > 0 ? Math.min(100, Math.round((doneCount / scopeInitial) * 100)) : 0

  // ─── confirmations mapped per item ───────────────────────────────────────
  const pendingByItem = useMemo(() => {
    const m = new Map<string, ConfirmationRequestT>()
    for (const r of pendingConfQ.data?.requests ?? []) if (!m.has(r.itemId)) m.set(r.itemId, r)
    return m
  }, [pendingConfQ.data])

  const decidedByItem = useMemo(() => {
    const m = new Map<string, ConfirmationRequestT>()
    const decided = (allConfQ.data?.requests ?? [])
      .filter(
        (r) =>
          (DECIDED_STATUSES as readonly string[]).includes(r.status) &&
          r.decidedAt !== null &&
          !dismissed.has(r.id)
      )
      .sort(
        (a, b) =>
          new Date(b.decidedAt ?? b.createdAt).getTime() - new Date(a.decidedAt ?? a.createdAt).getTime()
      )
    for (const r of decided) if (!m.has(r.itemId)) m.set(r.itemId, r)
    return m
  }, [allConfQ.data, dismissed])

  const dismissDecision = (id: string) =>
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })

  // ─── item mutations (with Shopping Mode cache refresh) ───────────────────
  const refreshShopping = () => {
    void qc.invalidateQueries({ queryKey: ['outstanding'] })
    void qc.invalidateQueries({ queryKey: ['confirmations'] })
    void qc.invalidateQueries({ queryKey: ['budgets'] })
  }

  const patchItem = (itemId: string, patch: Record<string, unknown>) => {
    updateItem.mutate({ itemId, patch }, { onSuccess: refreshShopping })
  }

  const markPurchased = (item: OutItem) => {
    patchItem(item.id, { status: 'PURCHASED' })
    toast({
      title: `Got ${item.name}`,
      description: 'Marked as purchased.',
      action: (
        <ToastAction
          altText={`Undo purchase of ${item.name}`}
          onClick={() => patchItem(item.id, { status: 'PENDING' })}
        >
          Undo
        </ToastAction>
      ),
    })
  }

  const markUnavailable = (item: OutItem) => patchItem(item.id, { status: 'UNAVAILABLE' })

  const requestSubstitute = (item: OutItem) => {
    const sub = window.prompt(`What did you buy instead of “${item.name}”?`)
    if (sub && sub.trim()) {
      patchItem(item.id, { status: 'SUBSTITUTED', substitutedWith: sub.trim() })
    }
  }

  const acceptSuggestion = (item: OutItem, conf: ConfirmationRequestT) => {
    if (!conf.substituteName) return
    patchItem(item.id, { status: 'SUBSTITUTED', substitutedWith: conf.substituteName })
    dismissDecision(conf.id)
  }

  const firstActiveListId =
    listsQ.data?.lists.find((l) => l.status === 'ACTIVE')?.id ?? listsQ.data?.lists[0]?.id ?? null

  const addUnexpected = (listId: string | null, storeId: string, name: string) => {
    if (!listId) return
    addItem.mutate(
      {
        listId,
        name,
        quantity: 1,
        unit: 'pc',
        category: 'OTHER',
        storeId: storeId === NONE_STORE ? null : storeId,
      },
      {
        onSuccess: () => {
          refreshShopping()
          toast({ description: `“${name}” added to your list.` })
        },
      }
    )
  }

  // ─── finish flow ─────────────────────────────────────────────────────────
  const onFinish = async () => {
    if (!sessionId || finishSession.isPending) return
    try {
      const res = await finishSession.mutateAsync(sessionId)
      setSummary({ session: res.session, data: (res.summary ?? {}) as SessionSummary })
    } catch {
      // useSyncedMutation already surfaced the error via toast
    }
  }

  const closeSummary = () => {
    setSummary(null)
    onClose()
  }

  // ─── store chips ─────────────────────────────────────────────────────────
  const chips = useMemo(() => {
    const byStore = new Map<string, number>()
    for (const g of groups) byStore.set(g.storeId, (byStore.get(g.storeId) ?? 0) + g.items.length)
    const list: { id: string; label: string; category?: string; count: number }[] = [
      { id: 'all', label: 'All stores', count: totalCount },
    ]
    for (const s of stores) list.push({ id: s.id, label: s.name, category: s.category, count: byStore.get(s.id) ?? 0 })
    if (byStore.has(NONE_STORE)) list.push({ id: NONE_STORE, label: 'Unassigned', count: byStore.get(NONE_STORE) ?? 0 })
    return list
  }, [groups, stores, totalCount])

  // ─── active list + TRIP budget bar ───────────────────────────────────────
  // The budget follows "the trip's list": the explicitly opened list, else the
  // first list that still has outstanding items (purely derived — the bar is
  // hidden once nothing is left, where the finish summary takes over).
  const activeListId = useMemo(() => {
    if (initialListId) return initialListId
    return groups.find((g) => g.items[0])?.items[0]?.listId ?? null
  }, [initialListId, groups])

  const listQ = useList(activeListId ?? undefined)
  const tripBudget = useMemo(
    () => budgetsQ.data?.budgets.find((b) => b.scope === 'TRIP' && b.listId === activeListId) ?? null,
    [budgetsQ.data, activeListId]
  )
  const spentCents = useMemo(() => {
    if (listQ.data) {
      const items = listQ.data.list.items as PricedItem[]
      return items
        .filter((i) => i.status === 'PURCHASED')
        .reduce((s, i) => s + (i.actualPriceCents ?? i.estimatedPriceCents ?? 0), 0)
    }
    return tripBudget?.spendCents ?? 0
  }, [listQ.data, tripBudget])
  const budgetOver = tripBudget != null && spentCents > tripBudget.amountCents

  const statusLine = outstandingQ.isLoading
    ? 'Loading your list…'
    : remainingCount === 0
      ? 'Nothing left to buy'
      : scopeInitial > 0
        ? `${doneCount} of ${scopeInitial} done`
        : `${remainingCount} left`

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
      {/* ─── Header: back, progress, store selector ─── */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-2xl px-3 pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onClose}
              aria-label="Exit Shopping Mode"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight tracking-tight">Shopping Mode</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
                {updateItem.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {statusLine}
              </p>
            </div>
          </div>

          {scopeInitial > 0 && (
            <Progress
              value={progressPct}
              className="mt-2 h-2"
              aria-label={`Progress: ${doneCount} of ${scopeInitial} items done`}
            />
          )}

          {/* Store chips */}
          <div className="mt-2.5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2.5 scrollbar-slim" aria-label="Filter by store">
            {chips.map((c) => {
              const active = activeStore === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => pickStore(c.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card text-foreground hover:border-primary/40'
                  )}
                >
                  {c.category && (
                    <span aria-hidden>{STORE_CATEGORY_EMOJI[c.category] ?? '🏬'}</span>
                  )}
                  {c.label}
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      active ? 'opacity-80' : 'text-muted-foreground'
                    )}
                  >
                    {c.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* ─── Items ─── */}
      <main className="flex-1 overflow-y-auto scrollbar-slim">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-3 py-3">
          {outstandingQ.isLoading ? (
            <div className="space-y-2" aria-label="Loading items">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visibleGroups.length === 0 ? (
            <Card>
              <CardContent className="space-y-1.5 py-10 text-center">
                <p className="text-2xl" aria-hidden>
                  🎉
                </p>
                <p className="font-medium">Nothing left to buy — nice work!</p>
                {doneCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    You checked off {doneCount} item{doneCount === 1 ? '' : 's'} this trip.
                  </p>
                )}
                {activeStore !== 'all' && totalCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Try “All stores” for items at other stores.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            visibleGroups.map((g) => {
              const groupListId = g.items[0]?.listId ?? firstActiveListId
              return (
                <section key={g.storeId} aria-label={`${g.storeName} — ${g.items.length} items left`}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.storeName} — {g.items.length} left
                  </h2>
                  <div className="space-y-2">
                    {g.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        pendingConf={pendingByItem.get(item.id) ?? null}
                        decidedConf={decidedByItem.get(item.id) ?? null}
                        onToggle={() => markPurchased(item)}
                        onUnavailable={() => markUnavailable(item)}
                        onSubstitute={() => requestSubstitute(item)}
                        onMove={() => setMoveTarget({ item, storeId: g.storeId })}
                        onAsk={() => setAskTarget(item)}
                        onQty={(q) => patchItem(item.id, { quantity: q })}
                        onAcceptSuggestion={() => {
                          const conf = decidedByItem.get(item.id)
                          if (conf) acceptSuggestion(item, conf)
                        }}
                        onDismissDecision={() => {
                          const conf = decidedByItem.get(item.id)
                          if (conf) dismissDecision(conf.id)
                        }}
                      />
                    ))}
                  </div>

                  {/* Unexpected finds */}
                  <AddUnexpected
                    storeName={g.storeName}
                    busy={addItem.isPending}
                    disabled={!groupListId}
                    onAdd={(name) => addUnexpected(groupListId, g.storeId, name)}
                  />
                </section>
              )
            })
          )}
        </div>
      </main>

      {/* ─── Bottom bar: budget + finish ─── */}
      <footer className="shrink-0 border-t bg-background px-3 pt-3 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-2xl space-y-2.5 pb-3">
          {tripBudget && (
            <div
              className={cn(
                'space-y-1.5 rounded-xl border p-3',
                budgetOver ? 'border-amber-500/50 bg-amber-500/5' : 'bg-card'
              )}
              aria-label={`Budget ${formatCents(spentCents)} of ${formatCents(tripBudget.amountCents)}`}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Trip budget
                </span>
                <span className="tabular-nums">
                  {formatCents(spentCents)}{' '}
                  <span className="text-muted-foreground">/ {formatCents(tripBudget.amountCents)}</span>
                </span>
              </div>
              <Progress
                value={tripBudget.amountCents > 0 ? Math.min(100, (spentCents / tripBudget.amountCents) * 100) : 0}
                className={cn(
                  'h-1.5',
                  budgetOver && 'bg-amber-500/20 [&>[data-slot=progress-indicator]]:bg-amber-500'
                )}
              />
              <p className="text-xs text-muted-foreground">
                {budgetOver
                  ? `Over by ${formatCents(spentCents - tripBudget.amountCents)}. `
                  : `${formatCents(tripBudget.amountCents - spentCents)} left. `}
                Estimates only — not a checkout total.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {startSession.isError && (
              <Button variant="outline" className="h-12 shrink-0 gap-1.5" onClick={startOrRetry}>
                <Loader2 className={cn('h-4 w-4', startSession.isPending && 'animate-spin')} />
                Retry session
              </Button>
            )}
            <Button
              className="h-12 flex-1 text-base font-semibold gap-2"
              onClick={onFinish}
              disabled={!sessionId || finishSession.isPending}
            >
              {finishSession.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-5 w-5" aria-hidden />
              )}
              Finish Shopping
            </Button>
          </div>
        </div>
      </footer>

      {/* ─── Move to another store ─── */}
      <MoveStoreDialog
        key={`move-${moveTarget?.item.id ?? 'none'}`}
        target={moveTarget}
        stores={stores}
        open={!!moveTarget}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        saving={updateItem.isPending}
        onSave={(storeId) => {
          if (!moveTarget) return
          patchItem(moveTarget.item.id, { storeId })
          setMoveTarget(null)
        }}
      />

      {/* ─── Ask family / send photo ─── */}
      <AskFamilyDialog
        key={`ask-${askTarget?.id ?? 'none'}`}
        item={askTarget}
        open={!!askTarget}
        onOpenChange={(o) => !o && setAskTarget(null)}
        pendingConf={askTarget ? (pendingByItem.get(askTarget.id) ?? null) : null}
      />

      {/* ─── Trip summary ─── */}
      <SummaryDialog open={!!summary} result={summary} onDone={closeSummary} />
    </div>
  )
}

// ═══ Item row ═════════════════════════════════════════════════════════════════

function ItemRow({
  item,
  pendingConf,
  decidedConf,
  onToggle,
  onUnavailable,
  onSubstitute,
  onMove,
  onAsk,
  onQty,
  onAcceptSuggestion,
  onDismissDecision,
}: {
  item: OutItem
  pendingConf: ConfirmationRequestT | null
  decidedConf: ConfirmationRequestT | null
  onToggle: () => void
  onUnavailable: () => void
  onSubstitute: () => void
  onMove: () => void
  onAsk: () => void
  onQty: (qty: number) => void
  onAcceptSuggestion: () => void
  onDismissDecision: () => void
}) {
  const [qtyOpen, setQtyOpen] = useState(false)

  return (
    <div className="flex min-h-16 items-start gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40">
      <span className="-m-2 inline-flex shrink-0 p-2">
        <Checkbox
          checked={false}
          onCheckedChange={() => onToggle()}
          className="h-8 w-8 rounded-full border-2"
          aria-label={`Mark ${item.name} as purchased`}
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="text-lg font-medium leading-snug break-words">{item.name}</span>
          <QtyBadge item={item} open={qtyOpen} onOpenChange={setQtyOpen} onSet={onQty} />
          {item.estimatedPriceCents != null && (
            <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
              {formatCents(item.estimatedPriceCents)}
            </span>
          )}
        </div>

        {item.nameBn && <p className="text-sm leading-snug text-muted-foreground">{item.nameBn}</p>}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.note && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <StickyNote className="h-3 w-3 shrink-0" aria-hidden />
              <span className="max-w-56 truncate">{item.note}</span>
            </span>
          )}
          {item.listName && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{item.listName}</span>
          )}
        </div>

        {pendingConf && (
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Hourglass className="h-3 w-3 shrink-0" aria-hidden />
            {pendingConf.photo && (
              <img
                src={pendingConf.photo.dataUrl}
                alt=""
                className="h-6 w-6 rounded object-cover"
              />
            )}
            <span className="truncate">
              Waiting for family
              {pendingConf.requestedBy ? ` · asked by ${pendingConf.requestedBy.name}` : ''}
              {' · '}
              {timeAgo(pendingConf.createdAt)}
            </span>
          </div>
        )}

        {decidedConf && (
          <DecisionBanner
            conf={decidedConf}
            onAccept={onAcceptSuggestion}
            onDismiss={onDismissDecision}
          />
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 size-11 shrink-0 text-muted-foreground"
            aria-label={`Actions for ${item.name}`}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onToggle}>
            <Check className="mr-2 h-4 w-4" /> Mark purchased
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onUnavailable}>
            <CircleOff className="mr-2 h-4 w-4" /> Not available
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSubstitute}>
            <Repeat className="mr-2 h-4 w-4" /> Bought a substitute…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => window.setTimeout(() => setQtyOpen(true), 10)}>
            <Minus className="mr-2 h-4 w-4" /> Change quantity…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMove}>
            <MapPin className="mr-2 h-4 w-4" /> Move to store…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAsk}>
            <HelpCircle className="mr-2 h-4 w-4" /> Send photo / ask family
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ═══ Quantity stepper (inline popover on the qty badge) ══════════════════════

function QtyBadge({
  item,
  open,
  onOpenChange,
  onSet,
}: {
  item: OutItem
  open: boolean
  onOpenChange: (o: boolean) => void
  onSet: (qty: number) => void
}) {
  const step = (d: number) => onSet(Math.max(1, Math.round((item.quantity + d) * 2) / 2))
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-sm font-medium tabular-nums hover:bg-accent"
          aria-label={`Change quantity for ${item.name} (currently ${item.quantity} ${item.unit})`}
        >
          {item.quantity} {item.unit}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quantity
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={() => step(-1)}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-14 text-center text-xl font-bold tabular-nums">{item.quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={() => step(1)}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{item.unit}</p>
      </PopoverContent>
    </Popover>
  )
}

// ═══ Family decision banner ══════════════════════════════════════════════════

function DecisionBanner({
  conf,
  onAccept,
  onDismiss,
}: {
  conf: ConfirmationRequestT
  onAccept: () => void
  onDismiss: () => void
}) {
  const who = conf.decidedBy?.name ?? 'Family'
  return (
    <div
      className={cn(
        'mt-2 space-y-1.5 rounded-lg border p-2 text-xs',
        conf.status === 'APPROVED' && 'border-primary/40 bg-primary/10',
        conf.status === 'REJECTED' && 'border-destructive/40 bg-destructive/10',
        conf.status === 'SUBSTITUTE_SUGGESTED' && 'border-violet-500/40 bg-violet-500/10'
      )}
    >
      <div className="flex items-start gap-2">
        {conf.status === 'APPROVED' && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        {conf.status === 'REJECTED' && <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />}
        {conf.status === 'SUBSTITUTE_SUGGESTED' && (
          <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          {conf.status === 'APPROVED' && (
            <p className="font-medium text-primary">{who} approved this item</p>
          )}
          {conf.status === 'REJECTED' && (
            <p className="font-medium text-destructive">{who} said this isn’t the right one</p>
          )}
          {conf.status === 'SUBSTITUTE_SUGGESTED' && (
            <p className="font-medium text-violet-600 dark:text-violet-400">
              {who} suggests: {conf.substituteName ?? 'a substitute'}
            </p>
          )}
          {conf.decisionNote && <p className="text-muted-foreground">{conf.decisionNote}</p>}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded p-1 hover:bg-accent"
          aria-label="Dismiss family response"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {conf.status === 'SUBSTITUTE_SUGGESTED' && conf.substituteName && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onAccept}>
          <Check className="h-3.5 w-3.5" /> Buy the suggestion
        </Button>
      )}
    </div>
  )
}

// ═══ Unexpected item quick-add (per store section) ═══════════════════════════

function AddUnexpected({
  storeName,
  busy,
  disabled,
  onAdd,
}: {
  storeName: string
  busy: boolean
  disabled: boolean
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState('')
  const submit = () => {
    const n = name.trim()
    if (!n) return
    onAdd(n)
    setName('')
  }
  return (
    <div className="mt-2 flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={`Spotted something else at ${storeName}?`}
        aria-label={`Add unexpected item at ${storeName}`}
        className="h-11"
      />
      <Button
        variant="outline"
        className="h-11 w-11 shrink-0 p-0"
        onClick={submit}
        disabled={disabled || busy || !name.trim()}
        aria-label="Add unexpected item"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
      </Button>
    </div>
  )
}

// ═══ Move to store dialog ════════════════════════════════════════════════════

function MoveStoreDialog({
  target,
  stores,
  open,
  onOpenChange,
  saving,
  onSave,
}: {
  target: { item: OutItem; storeId: string } | null
  stores: Store[]
  open: boolean
  onOpenChange: (o: boolean) => void
  saving: boolean
  onSave: (storeId: string | null) => void
}) {
  // remounted per target (parent passes a key), so initial value is per-item
  const [val, setVal] = useState(() =>
    target ? (target.storeId === NONE_STORE ? '' : target.storeId) : ''
  )

  return (
    <Dialog open={open && !!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move “{target?.item.name}”</DialogTitle>
          <DialogDescription>Pick which store to shop this item at.</DialogDescription>
        </DialogHeader>
        <select
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="h-10 w-full rounded-md border bg-background px-2.5 text-sm"
          aria-label="Store"
        >
          <option value="">Unassigned</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(val || null)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══ Ask family dialog (per-item hook instance) ══════════════════════════════

function AskFamilyDialog({
  item,
  open,
  onOpenChange,
  pendingConf,
}: {
  item: OutItem | null
  open: boolean
  onOpenChange: (o: boolean) => void
  pendingConf: ConfirmationRequestT | null
}) {
  const ask = useAskFamily(item?.id ?? '')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPick = async (file: File) => {
    try {
      setPhoto(await compressImageFile(file))
    } catch (err) {
      toast({
        description: err instanceof Error ? err.message : 'Could not read that image.',
      })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = async () => {
    if (!item || sending) return
    setSending(true)
    try {
      await ask.mutateAsync({ note: note.trim() || null, photoDataUrl: photo })
      toast({ description: `Asked your family about “${item.name}” — they can respond from the item.` })
      onOpenChange(false)
    } catch {
      // useSyncedMutation already surfaced the error via toast
    } finally {
      setSending(false)
    }
  }

  const waiting = pendingConf?.status === 'PENDING'

  return (
    <Dialog open={open && !!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask family about “{item?.name}”</DialogTitle>
          <DialogDescription>
            Send a photo or note — they respond from the item page while you keep shopping.
          </DialogDescription>
        </DialogHeader>

        {waiting ? (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <p className="inline-flex items-center gap-1.5 font-medium">
              <Hourglass className="h-4 w-4" aria-hidden /> Already waiting for family
            </p>
            {pendingConf?.requestedBy && (
              <p className="text-xs">Asked by {pendingConf.requestedBy.name} · {timeAgo(pendingConf.createdAt)}</p>
            )}
            {pendingConf?.note && <p className="text-xs">“{pendingConf.note}”</p>}
            {pendingConf?.photo && (
              <img
                src={pendingConf.photo.dataUrl}
                alt="Photo attached to the question"
                className="max-h-40 rounded-md border"
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Optional note — e.g. “is this the right olive oil?”"
              aria-label="Note for your family"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
            {photo && (
              <div className="flex items-center gap-2">
                <img src={photo} alt="Photo to send" className="h-16 w-16 rounded-md border object-cover" />
                <Button variant="ghost" size="sm" onClick={() => setPhoto(null)} aria-label="Remove photo">
                  <X className="h-4 w-4" /> Remove
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={sending}
              >
                <Camera className="h-4 w-4" /> {photo ? 'Change photo' : 'Add photo'}
              </Button>
              <Button
                className="h-11 flex-1 gap-1.5"
                onClick={send}
                disabled={sending || (!note.trim() && !photo)}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
              </Button>
            </div>
            {!note.trim() && !photo && (
              <p className="text-xs text-muted-foreground">
                Add a note or a photo so your family knows what to check.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ═══ Trip summary dialog ═════════════════════════════════════════════════════

function SummaryDialog({
  open,
  result,
  onDone,
}: {
  open: boolean
  result: { session: ShoppingSessionT; data: SessionSummary } | null
  onDone: () => void
}) {
  const purchased = result?.data.purchased ?? []
  const unavailable = result?.data.unavailable ?? []
  const remaining = result?.data.remaining ?? []

  return (
    <Dialog open={open && !!result} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trip complete 🎉</DialogTitle>
          <DialogDescription>Here’s what happened on this shopping trip.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[55dvh] space-y-4 overflow-y-auto px-1 scrollbar-slim">
          <section aria-label="Purchased items">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Purchased ({purchased.length})
            </h3>
            {purchased.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing was marked purchased.</p>
            ) : (
              <ul className="space-y-1">
                {purchased.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {p.name}
                      {p.quantity ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {p.quantity}
                          {p.unit ? ` ${p.unit}` : ''}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {p.priceCents != null ? (
                        formatCents(p.priceCents)
                      ) : (
                        <span className="text-xs text-muted-foreground">no price</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {unavailable.length > 0 && (
            <section aria-label="Unavailable items">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unavailable ({unavailable.length})
              </h3>
              <ul className="space-y-1">
                {unavailable.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CircleOff className="h-3.5 w-3.5 shrink-0" aria-hidden /> {p.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {remaining.length > 0 && (
            <section aria-label="Remaining items">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Still on the list ({remaining.length})
              </h3>
              <ul className="space-y-1">
                {remaining.map((p) => (
                  <li key={p.id} className="text-sm text-muted-foreground">
                    {p.name}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Unfinished items stay on your list.
              </p>
            </section>
          )}

          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Known spending
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {formatCents(result?.session.spentCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Items without a recorded price aren’t included.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button className="h-11 w-full sm:w-auto" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
