'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  ArrowLeft,
  Plus,
  ChevronDown,
  Share2,
  MapPin,
  MessageSquare,
  Camera,
  StickyNote,
  MoreHorizontal,
  Pencil,
  AlertTriangle,
  Repeat2,
} from 'lucide-react'
import { useList, useUpdateItem, useStores, useUpdateList, useAddItem } from '@/lib/shopnest/hooks'
import { CATEGORY_EMOJI, STORE_CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import { cn } from '@/lib/utils'
import type { Me, ShoppingItem } from '@/lib/shopnest/types'
import { StatusBadge } from '@/components/shopnest/ui-bits'
import { AddItemDialog } from '@/components/shopnest/add-item-dialog'
import { ItemSheet } from '@/components/shopnest/item-sheet'

export function ListDetail({
  listId,
  me,
  householdId,
  onBack,
}: {
  listId: string
  me: Me
  householdId: string
  onBack: () => void
}) {
  const listQ = useList(listId)
  const storesQ = useStores(householdId)
  const updateItem = useUpdateItem(householdId)
  const updateList = useUpdateList(householdId)
  const addItem = useAddItem(householdId)

  const [quickName, setQuickName] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  const list = listQ.data?.list
  const stores = storesQ.data?.stores ?? []

  const grouped = useMemo(() => {
    const items = list?.items ?? []
    return {
      attention: items.filter((i) => i.status === 'UNAVAILABLE' || i.status === 'SUBSTITUTED'),
      pending: items.filter((i) => i.status === 'PENDING'),
      purchased: items.filter((i) => i.status === 'PURCHASED'),
    }
  }, [list])

  const quickAdd = () => {
    const name = quickName.trim()
    if (!name) return
    addItem.mutate({ listId, name, quantity: 1, unit: 'pc', category: 'OTHER' })
    setQuickName('')
  }

  const togglePurchased = (item: ShoppingItem) => {
    updateItem.mutate({ itemId: item.id, patch: { status: item.status === 'PURCHASED' ? 'PENDING' : 'PURCHASED' } })
  }

  const shareList = () => {
    const url = `${window.location.origin}/?list=${listId}`
    if (navigator.share) {
      navigator.share({ title: list?.name ?? 'ShopNest list', url }).catch(() => {
        navigator.clipboard.writeText(url).catch(() => {})
      })
    } else {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack} aria-label="Back to lists">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate flex items-center gap-2">
            <span aria-hidden>{list?.emoji}</span>
            <span className="truncate">{list?.name ?? '…'}</span>
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {list?.store ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>{STORE_CATEGORY_EMOJI[list.store.category] ?? '🏬'}</span>
                {list.store.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> No store selected</span>
            )}
            {list && (
              <>
                <span aria-hidden>·</span>
                <span>{grouped.pending.length} to buy</span>
              </>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="List actions">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={shareList}>
              <Share2 className="mr-2 h-4 w-4" /> Share list link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!list) return
                const name = window.prompt('Rename list', list.name)
                if (name && name.trim()) updateList.mutate({ listId: list.id, name: name.trim() })
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!list) return
                const storeId = window.prompt(
                  `Store for this list (ids): \n${stores.map((s) => `${s.name}: ${s.id}`).join('\n')}\nLeave empty for none`
                )
                if (storeId !== null) updateList.mutate({ listId: list.id, storeId: storeId || null })
              }}
            >
              <MapPin className="mr-2 h-4 w-4" /> Change store
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <Input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder="Add an item — e.g. Milk, ইলিশ, halal chicken…"
          aria-label="Quick add item"
          className="h-11"
        />
        <Button className="h-11 w-11 p-0 shrink-0" onClick={quickAdd} disabled={!quickName.trim()} aria-label="Add item">
          <Plus className="h-5 w-5" />
        </Button>
        <Button variant="outline" className="h-11 shrink-0 gap-1" onClick={() => setAddOpen(true)}>
          <span className="hidden sm:inline">More</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : !list ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">List not found.</CardContent>
        </Card>
      ) : (
        <>
          {/* Needs attention */}
          {grouped.attention.length > 0 && (
            <section aria-label="Items needing attention" className="space-y-1.5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Needs attention</h2>
              {grouped.attention.map((item) => (
                <ItemRow key={item.id} item={item} me={me} onToggle={() => togglePurchased(item)} onOpen={() => setOpenItemId(item.id)} highlight />
              ))}
            </section>
          )}

          {/* To buy */}
          <section aria-label="Items to buy" className="space-y-1.5">
            {grouped.pending.length === 0 && grouped.attention.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {grouped.purchased.length > 0 ? 'All picked up — nice work! 🎉' : 'Nothing here yet. Add your first item above.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              grouped.pending.map((item) => (
                <ItemRow key={item.id} item={item} me={me} onToggle={() => togglePurchased(item)} onOpen={() => setOpenItemId(item.id)} />
              ))
            )}
          </section>

          {/* Purchased */}
          {grouped.purchased.length > 0 && (
            <section aria-label="Purchased items" className="space-y-1.5">
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', !showDone && '-rotate-90')} />
                Purchased ({grouped.purchased.length})
              </button>
              {showDone &&
                grouped.purchased.map((item) => (
                  <ItemRow key={item.id} item={item} me={me} onToggle={() => togglePurchased(item)} onOpen={() => setOpenItemId(item.id)} />
                ))}
            </section>
          )}
        </>
      )}

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        householdId={householdId}
        listId={listId}
      />

      {openItemId && (
        <ItemSheet
          listId={listId}
          itemId={openItemId}
          householdId={householdId}
          me={me}
          open={!!openItemId}
          onOpenChange={(o) => !o && setOpenItemId(null)}
        />
      )}
    </div>
  )
}

function ItemRow({
  item,
  me,
  onToggle,
  onOpen,
  highlight,
}: {
  item: ShoppingItem
  me: Me
  onToggle: () => void
  onOpen: () => void
  highlight?: boolean
}) {
  const purchased = item.status === 'PURCHASED'
  const photos = item.photos ?? []
  const comments = item.comments ?? []
  const openQuestions = comments.filter((c) => c.kind === 'REJECT').length

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-xl border bg-card p-2.5 transition-colors hover:border-primary/40',
        highlight && 'border-amber-500/50 bg-amber-500/5',
        purchased && 'opacity-70'
      )}
    >
      <Checkbox
        checked={purchased}
        onCheckedChange={onToggle}
        className="h-7 w-7 rounded-full shrink-0"
        aria-label={purchased ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`}
      />
      <button className="min-w-0 flex-1 text-left" onClick={onOpen} aria-label={`Open ${item.name}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0" aria-hidden>{CATEGORY_EMOJI[item.category] ?? '🛒'}</span>
          <span className={cn('font-medium truncate', purchased && 'line-through text-muted-foreground')}>{item.name}</span>
          {item.isRecurring && <Repeat2 className="h-3.5 w-3.5 text-primary shrink-0" aria-label="recurring" />}
          <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
            {item.quantity} {item.unit}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {item.nameBn && <span className="text-xs text-muted-foreground">{item.nameBn}</span>}
          {item.note && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1 min-w-0">
              <StickyNote className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-48">{item.note}</span>
            </span>
          )}
          {item.store && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {item.store.name}
            </span>
          )}
          <StatusBadge status={item.status} substitutedWith={item.substitutedWith} />
          {photos.length > 0 && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
              <Camera className="h-3 w-3" /> {photos.length}
            </span>
          )}
          {comments.length > 0 && (
            <span className={cn('text-xs inline-flex items-center gap-0.5', openQuestions > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
              <MessageSquare className="h-3 w-3" /> {comments.length}
            </span>
          )}
          {purchased && item.purchasedBy && (
            <span className="text-xs text-muted-foreground">by {item.purchasedBy.name}</span>
          )}
        </div>
      </button>
      {item.status === 'UNAVAILABLE' && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-label="unavailable" />}
    </div>
  )
}
