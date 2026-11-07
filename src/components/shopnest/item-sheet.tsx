'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Banknote,
  Camera,
  Check,
  CircleOff,
  HelpCircle,
  History,
  Loader2,
  Repeat,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { ApiClientError } from '@/lib/shopnest/client'
import {
  useAddComment,
  useAddPhoto,
  useAddPriceObservation,
  useAskFamily,
  useDecideConfirmation,
  useDeleteItem,
  useDeletePhoto,
  useItemConfirmations,
  useList,
  usePantry,
  usePriceObservations,
  useStores,
  useUpdateItem,
  useUpdatePantryItem,
  type ConfirmationRequestT,
  type PriceObservationT,
} from '@/lib/shopnest/hooks'
import { compressImageFile } from '@/lib/shopnest/compress'
import { dollarsToCents, formatCents, isPriceStale } from '@/lib/shopnest/money'
import { CATEGORY_EMOJI, CATEGORY_LABEL, ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'
import { StatusBadge, UserChip, timeAgo } from '@/components/shopnest/ui-bits'
import type { ItemComment, Me, ShoppingItem } from '@/lib/shopnest/types'

/**
 * The item API returns integer-cents price fields that the shared client
 * type doesn't declare yet; they are optional here so a `ShoppingItem`
 * stays assignable and older payloads (missing the fields) stay safe.
 */
type ItemWithPrices = ShoppingItem & {
  estimatedPriceCents?: number | null
  actualPriceCents?: number | null
}

/** Max data-URL length the API accepts for photos (~700KB). */
const MAX_PHOTO_DATAURL = 700_000

/** Integer cents → "3.48" for a text input (display only, never used for math). */
function centsToInput(cents: number | null | undefined): string {
  return typeof cents === 'number' && Number.isInteger(cents) && cents >= 0 ? (cents / 100).toFixed(2) : ''
}

function priceSourceLabel(source: string): string {
  switch (source) {
    case 'USER_ENTERED':
      return 'You entered'
    case 'RECEIPT':
      return 'Receipt'
    case 'RETAILER_AUTHORIZED':
      return 'Retailer'
    case 'PARTNER_FEED':
      return 'Partner feed'
    case 'COMMUNITY':
      return 'Community'
    default:
      return source.replace(/_/g, ' ').toLowerCase()
  }
}

function ConfirmationBadge({ request }: { request: ConfirmationRequestT }) {
  switch (request.status) {
    case 'PENDING':
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
          Waiting for family
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          Approved
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
          Wrong product
        </Badge>
      )
    case 'SUBSTITUTE_SUGGESTED':
      return (
        <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-600">
          {request.substituteName ? `Substitute: ${request.substituteName}` : 'Substitute suggested'}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Cancelled
        </Badge>
      )
  }
}

export function ItemSheet({
  listId,
  itemId,
  householdId,
  me,
  open,
  onOpenChange,
}: {
  listId: string
  itemId: string
  householdId: string
  me: Me
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const listQ = useList(listId)

  const rawItem = (listQ.data?.list.items ?? []).find((i) => i.id === itemId) ?? null
  const item: ItemWithPrices | null = rawItem

  const storesQ = useStores(householdId)
  const updateItem = useUpdateItem(householdId)
  const deleteItem = useDeleteItem(householdId)
  const addComment = useAddComment(householdId)
  const addPhoto = useAddPhoto(householdId)
  const deletePhoto = useDeletePhoto(householdId)

  // V2: pantry awareness (never blocks purchase)
  const pantryQ = usePantry(householdId)
  const updatePantryItem = useUpdatePantryItem(householdId)

  // V2: price memory
  const pricesQ = usePriceObservations(householdId, item?.name)
  const addPrice = useAddPriceObservation(householdId)

  // V2: Ask Family confirmations
  const confirmQ = useItemConfirmations(itemId)
  const askFamily = useAskFamily(itemId)
  const decideConf = useDecideConfirmation(householdId)

  const stores = storesQ.data?.stores ?? []
  const photos = item?.photos ?? []
  const comments = item?.comments ?? []
  const requests = confirmQ.data?.requests ?? []

  // details form
  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('pc')
  const [note, setNote] = useState('')
  const [storeId, setStoreId] = useState('')
  const [category, setCategory] = useState('OTHER')
  const [estPrice, setEstPrice] = useState('')
  const [actPrice, setActPrice] = useState('')

  // photos & comments
  const [comment, setComment] = useState('')
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Ask Family
  const [askOpen, setAskOpen] = useState(false)
  const [askNote, setAskNote] = useState('')
  const [askPhoto, setAskPhoto] = useState<string | null>(null)
  const [askBusy, setAskBusy] = useState(false)
  const [decideNote, setDecideNote] = useState('')
  const askFileRef = useRef<HTMLInputElement>(null)

  // Price memory dialog
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceStore, setPriceStore] = useState('')
  const [priceAmount, setPriceAmount] = useState('')
  const [priceQty, setPriceQty] = useState('1')
  const [priceUnit, setPriceUnit] = useState('pc')
  const [pricePackage, setPricePackage] = useState('')

  // pantry awareness: 'shown' → notice visible, 'dismissed' → user opted out of nagging
  const [pantryAck, setPantryAck] = useState<'none' | 'shown' | 'dismissed'>('none')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setNameBn(item.nameBn ?? '')
      setQty(String(item.quantity))
      setUnit(item.unit)
      setNote(item.note ?? '')
      setStoreId(item.storeId ?? '')
      setCategory(item.category)
      setEstPrice(centsToInput(item.estimatedPriceCents))
      setActPrice(centsToInput(item.actualPriceCents))
      setPantryAck('none')
    }
  }, [item?.id, item?.updatedAt])

  /** Latest saved price for this item, one per store (newest first). */
  const latestPricesPerStore = useMemo(() => {
    const byStore = new Map<string, PriceObservationT>()
    for (const o of pricesQ.data?.observations ?? []) {
      const key = o.storeId ?? '__no_store__'
      const prev = byStore.get(key)
      if (!prev || new Date(o.observedAt).getTime() > new Date(prev.observedAt).getTime()) byStore.set(key, o)
    }
    return [...byStore.values()].sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
  }, [pricesQ.data])

  /** Pantry item with the same (case-insensitive) name currently in stock. */
  const pantryMatch = useMemo(() => {
    if (!item) return null
    const name = item.name.trim().toLowerCase()
    if (!name) return null
    return (
      (pantryQ.data?.items ?? []).find((p) => p.status === 'IN_STOCK' && p.name.trim().toLowerCase() === name) ??
      null
    )
  }, [item, pantryQ.data])

  const pendingRequest = requests.find((r) => r.status === 'PENDING') ?? null

  if (!item) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[80dvh] sm:max-w-lg sm:mx-auto rounded-t-xl p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Item</SheetTitle>
            <SheetDescription>This item is no longer on the list.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    )
  }

  const saveDetails = async () => {
    setSaving(true)
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        patch: {
          name: name.trim() || item.name,
          nameBn: nameBn.trim() || null,
          quantity: Math.max(Number(qty) || 1, 0.1),
          unit,
          note: note.trim() || null,
          storeId: storeId || null,
          category,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  /** Integer-cents only: parse → validate → patch; never float math. */
  const savePrices = async () => {
    const est = estPrice.trim() === '' ? null : dollarsToCents(estPrice)
    const act = actPrice.trim() === '' ? null : dollarsToCents(actPrice)
    if ((estPrice.trim() !== '' && est === null) || (actPrice.trim() !== '' && act === null)) {
      toast({ variant: 'destructive', description: 'Enter prices like 3.48 — numbers only.' })
      return
    }
    setSaving(true)
    try {
      const patch: { estimatedPriceCents: number | null; actualPriceCents?: number | null } = {
        estimatedPriceCents: est,
      }
      if (item.status === 'PURCHASED') patch.actualPriceCents = act
      await updateItem.mutateAsync({ itemId: item.id, patch })
    } finally {
      setSaving(false)
    }
  }

  const onPickFile = async (file: File) => {
    setUploading(true)
    try {
      const dataUrl = await compressImageFile(file)
      await addPhoto.mutateAsync({ itemId: item.id, dataUrl })
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const sendComment = (kind: ItemComment['kind'] = 'COMMENT') => {
    const text = comment.trim()
    if (!text) return
    addComment.mutate({ itemId: item.id, kind, text })
    setComment('')
  }

  // ── V2: status & pantry-aware purchase ────────────────────────────────────

  const markPurchased = (alsoClearPantry: boolean) => {
    updateItem.mutate({ itemId: item.id, patch: { status: 'PURCHASED' } })
    if (alsoClearPantry && pantryMatch) {
      updatePantryItem.mutate({ id: pantryMatch.id, status: 'OUT_OF_STOCK' })
    }
    setPantryAck('none')
  }

  const onTogglePurchased = () => {
    if (item.status === 'PURCHASED') {
      updateItem.mutate({ itemId: item.id, patch: { status: 'PENDING' } })
      return
    }
    // Pantry awareness is a heads-up, never a blocker: dismissal is enough.
    if (pantryMatch && pantryAck === 'none') {
      setPantryAck('shown')
      return
    }
    markPurchased(false)
  }

  // ── V2: Ask Family ────────────────────────────────────────────────────────

  /** Compress, then shrink further until the data URL fits the ~700KB API limit. */
  const onPickAskPhoto = async (file: File) => {
    try {
      let dataUrl = await compressImageFile(file)
      let maxSize = 640
      while (dataUrl.length > MAX_PHOTO_DATAURL && maxSize >= 320) {
        dataUrl = await compressImageFile(file, maxSize, 0.5)
        maxSize = Math.round(maxSize * 0.7)
      }
      if (dataUrl.length > MAX_PHOTO_DATAURL) {
        toast({ variant: 'destructive', description: 'Photo is too large even after compression — try another one.' })
        return
      }
      setAskPhoto(dataUrl)
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof Error ? err.message : 'Could not read the image.',
      })
    } finally {
      if (askFileRef.current) askFileRef.current.value = ''
    }
  }

  const sendAsk = async () => {
    if (!askNote.trim() && !askPhoto) return
    setAskBusy(true)
    try {
      await askFamily.mutateAsync({ note: askNote.trim() || null, photoDataUrl: askPhoto })
      setAskOpen(false)
      setAskNote('')
      setAskPhoto(null)
    } catch {
      // error already toasted by the shared mutation wrapper
    } finally {
      setAskBusy(false)
    }
  }

  const onDecide = async (
    request: ConfirmationRequestT,
    decision: 'APPROVED' | 'REJECTED' | 'SUBSTITUTE_SUGGESTED',
    opts: { substituteName?: string } = {}
  ) => {
    try {
      await decideConf.mutateAsync({
        id: request.id,
        action: 'decide',
        decision,
        note: decideNote.trim() || null,
        substituteName: opts.substituteName ?? null,
        version: request.version,
      })
      setDecideNote('')
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        toast({ description: 'Someone just responded — refresh to see it.' })
      }
    }
  }

  const onSuggestSubstitute = (request: ConfirmationRequestT) => {
    const sub = window.prompt(`What substitute did you find for “${item.name}”?`)
    if (sub && sub.trim()) void onDecide(request, 'SUBSTITUTE_SUGGESTED', { substituteName: sub.trim() })
  }

  const onCancelRequest = async (request: ConfirmationRequestT) => {
    try {
      await decideConf.mutateAsync({ id: request.id, action: 'cancel', version: request.version })
    } catch {
      // error already toasted by the shared mutation wrapper
    }
  }

  // ── V2: price memory ──────────────────────────────────────────────────────

  const openPriceDialog = () => {
    setPriceStore(item.storeId ?? '')
    setPriceAmount(item.status === 'PURCHASED' ? actPrice : '')
    setPriceQty(qty || '1')
    setPriceUnit(unit)
    setPricePackage('')
    setPriceOpen(true)
  }

  const savePriceObservation = async () => {
    const cents = dollarsToCents(priceAmount)
    if (cents === null || cents <= 0) {
      toast({ variant: 'destructive', description: 'Enter the amount you paid, like 3.48.' })
      return
    }
    const quantity = Number(priceQty)
    try {
      await addPrice.mutateAsync({
        itemName: item.name,
        nameBn: item.nameBn,
        storeId: priceStore || null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit: priceUnit || 'pc',
        packageSize: pricePackage.trim() || null,
        totalPriceCents: cents,
        source: 'USER_ENTERED',
      })
      setPriceOpen(false)
    } catch {
      // error already toasted by the shared mutation wrapper
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] sm:max-w-lg sm:mx-auto rounded-t-xl p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 shrink-0 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <span aria-hidden>{CATEGORY_EMOJI[item.category] ?? '🛒'}</span>
                <span className="truncate">{item.name}</span>
                <StatusBadge status={item.status} substitutedWith={item.substitutedWith} />
              </SheetTitle>
              <SheetDescription className="truncate">
                {item.quantity} {item.unit}
                {item.nameBn ? ` · ${item.nameBn}` : ''} · added by {item.addedBy?.name ?? 'someone'} {timeAgo(item.createdAt)}
              </SheetDescription>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">by {me.name}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-slim p-4 space-y-4">
          {/* Status actions + pantry awareness */}
          <section aria-label="Status" className="rounded-xl border bg-card p-3 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Status</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={item.status === 'PURCHASED' ? 'default' : 'outline'}
                onClick={onTogglePurchased}
                className="gap-1.5"
              >
                <ShoppingCart className="h-4 w-4" /> {item.status === 'PURCHASED' ? 'Purchased ✓' : 'Mark purchased'}
              </Button>
              <Button
                size="sm"
                variant={item.status === 'UNAVAILABLE' ? 'default' : 'outline'}
                onClick={() => updateItem.mutate({ itemId: item.id, patch: { status: item.status === 'UNAVAILABLE' ? 'PENDING' : 'UNAVAILABLE' } })}
                className="gap-1.5"
              >
                <CircleOff className="h-4 w-4" /> Not available
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const sub = window.prompt(`What did you buy instead of “${item.name}”?`)
                  if (sub && sub.trim()) {
                    updateItem.mutate({ itemId: item.id, patch: { status: 'SUBSTITUTED', substitutedWith: sub.trim() } })
                  }
                }}
              >
                <Repeat className="h-4 w-4" /> Substitute
              </Button>
            </div>
            {pantryMatch && pantryAck === 'shown' && item.status !== 'PURCHASED' && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm text-amber-600">
                <div className="flex items-start justify-between gap-2">
                  <p>
                    You marked <span className="font-semibold">{pantryMatch.name}</span> as in stock in your pantry. Add anyway?
                  </p>
                  <button
                    type="button"
                    onClick={() => setPantryAck('dismissed')}
                    aria-label="Dismiss pantry notice"
                    className="mt-0.5 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => markPurchased(false)}
                  >
                    Add anyway
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => markPurchased(true)}
                  >
                    Also mark pantry as out of stock
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Ask Family (photo confirmations) */}
          <section aria-label="Ask family" className="rounded-xl border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Ask family</h3>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-[11px]"
                onClick={() => setAskOpen(true)}
                disabled={!!pendingRequest}
                title={pendingRequest ? 'A request is already waiting for family input' : undefined}
              >
                <Camera className="h-3.5 w-3.5" /> Ask Family
              </Button>
            </div>
            {confirmQ.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading requests…
              </div>
            ) : requests.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Not sure which one to grab? Snap a photo and ask the household — they can confirm while you keep shopping.
              </p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => {
                  const decidable = me.id !== r.requestedBy?.id && r.status === 'PENDING'
                  const cancellable = me.id === r.requestedBy?.id && r.status === 'PENDING'
                  const photo = r.photo
                  return (
                    <li key={r.id} className="space-y-2 rounded-lg border p-2">
                      <div className="flex items-start gap-2">
                        {photo ? (
                          <button
                            type="button"
                            className="shrink-0 rounded-md overflow-hidden border focus:outline-ring"
                            onClick={() => setZoomPhoto(photo.dataUrl)}
                            aria-label="View request photo"
                          >
                            <img src={photo.dataUrl} alt="Confirmation request" className="h-12 w-12 object-cover" />
                          </button>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted">
                            <HelpCircle className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <UserChip name={r.requestedBy?.name ?? '?'} color={r.requestedBy?.avatarColor ?? '#888888'} size={20} />
                            <span className="text-sm font-medium">{r.requestedBy?.name ?? 'Someone'}</span>
                            <ConfirmationBadge request={r} />
                            <span className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                          </div>
                          {r.note && <p className="mt-0.5 text-sm break-words">“{r.note}”</p>}
                          {r.decidedBy && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {r.decidedBy.name}{' '}
                              {r.status === 'APPROVED' ? 'approved' : r.status === 'REJECTED' ? 'rejected' : 'responded'}
                              {r.decidedAt ? ` ${timeAgo(r.decidedAt)}` : ''}
                              {r.decisionNote ? ` — “${r.decisionNote}”` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {decidable && (
                        <div className="space-y-2 border-t pt-2">
                          <Input
                            value={decideNote}
                            onChange={(e) => setDecideNote(e.target.value)}
                            placeholder="Optional note for your reply…"
                            aria-label="Decision note"
                            className="h-8 text-sm"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => void onDecide(r, 'APPROVED')}
                              disabled={decideConf.isPending}
                            >
                              <Check className="h-4 w-4" /> Buy this
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => void onDecide(r, 'REJECTED')}
                              disabled={decideConf.isPending}
                            >
                              <X className="h-4 w-4" /> Wrong product
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 border-violet-500/40 text-violet-600 hover:bg-violet-500/10"
                              onClick={() => onSuggestSubstitute(r)}
                              disabled={decideConf.isPending}
                            >
                              <Repeat className="h-4 w-4" /> Suggest substitute
                            </Button>
                          </div>
                        </div>
                      )}
                      {cancellable && (
                        <div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-destructive"
                            onClick={() => void onCancelRequest(r)}
                            disabled={decideConf.isPending}
                          >
                            <X className="h-3.5 w-3.5" /> Cancel request
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Photos */}
          <section aria-label="Photos" className="rounded-xl border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Photos & product check</h3>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void onPickFile(e.target.files[0])}
              />
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-[11px] shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {uploading ? 'Uploading…' : 'Add photo'}
              </Button>
            </div>
            {photos.length === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                Shopping in-store? Attach a photo and ask the household “is this the right one?” — they can approve or reject.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative group">
                    <button
                      className="block w-full aspect-square rounded-lg overflow-hidden border focus:outline-ring"
                      onClick={() => setZoomPhoto(p.dataUrl)}
                      aria-label="View photo"
                    >
                      <img src={p.dataUrl} alt="Item photo" className="h-full w-full object-cover" />
                    </button>
                    <button
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white p-0.5"
                      onClick={() => deletePhoto.mutate({ itemId: item.id, photoId: p.id })}
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => sendComment('APPROVE')} disabled={!comment.trim()}>
                  <Check className="h-4 w-4" /> Approve with note
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => sendComment('REJECT')}
                  disabled={!comment.trim()}
                >
                  <X className="h-4 w-4" /> Reject with note
                </Button>
              </div>
            )}
            {photos.length > 0 && (
              <p className="text-[11px] text-muted-foreground">Write a note above, then approve or reject the photo.</p>
            )}
          </section>

          {/* Comments */}
          <section aria-label="Comments" className="rounded-xl border bg-card p-3 space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Discussion ({comments.length})</h3>
            {comments.length === 0 && <p className="text-xs text-muted-foreground">No messages yet.</p>}
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <UserChip name={c.user.name} color={c.user.avatarColor} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{c.user.name}</span>
                      {c.kind !== 'COMMENT' && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0',
                            c.kind === 'APPROVE' && 'border-primary/40 text-primary',
                            c.kind === 'REJECT' && 'border-destructive/40 text-destructive',
                            c.kind === 'SUBSTITUTE' && 'border-violet-500/40 text-violet-600'
                          )}
                        >
                          {c.kind}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-sm break-words">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendComment()}
                placeholder="Write a message…"
                aria-label="Write a comment"
              />
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => sendComment()} disabled={!comment.trim()} aria-label="Send comment">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {comments.some((c) => c.kind === 'SUBSTITUTE') && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const sub = comments.find((c) => c.kind === 'SUBSTITUTE')?.text
                  if (sub) updateItem.mutate({ itemId: item.id, patch: { status: 'SUBSTITUTED', substitutedWith: sub.slice(0, 80) } })
                }}
              >
                <Repeat className="h-4 w-4" /> Use suggested substitute
              </Button>
            )}
          </section>

          {/* Price */}
          <section aria-label="Price" className="rounded-xl border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Price</h3>
              <span className="text-[11px] text-muted-foreground">Prices are stored in USD</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="it-est-price">Estimated price</Label>
                <Input
                  id="it-est-price"
                  inputMode="decimal"
                  placeholder="e.g. 3.48"
                  value={estPrice}
                  onChange={(e) => setEstPrice(e.target.value)}
                  className="tabular-nums"
                />
                {item.estimatedPriceCents != null && (
                  <p className="text-[11px] text-muted-foreground tabular-nums">Saved: {formatCents(item.estimatedPriceCents)}</p>
                )}
              </div>
              {item.status === 'PURCHASED' && (
                <div className="space-y-1.5">
                  <Label htmlFor="it-act-price">Actual paid</Label>
                  <Input
                    id="it-act-price"
                    inputMode="decimal"
                    placeholder="e.g. 3.99"
                    value={actPrice}
                    onChange={(e) => setActPrice(e.target.value)}
                    className="tabular-nums"
                  />
                  {item.actualPriceCents != null && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">Paid: {formatCents(item.actualPriceCents)}</p>
                  )}
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => void savePrices()} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Save prices
            </Button>
          </section>

          {/* Price memory */}
          <section aria-label="Price memory" className="rounded-xl border bg-card p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Price memory</h3>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px] shrink-0" onClick={openPriceDialog}>
                <History className="h-3.5 w-3.5" /> Save current price to Price Memory
              </Button>
            </div>
            {pricesQ.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading prices…
              </div>
            ) : latestPricesPerStore.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved prices for “{item.name}” yet.</p>
            ) : (
              <ul className="space-y-2">
                {latestPricesPerStore.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-2 rounded-lg border p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.store?.name ?? o.storeName ?? 'Unknown store'}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatCents(o.totalPriceCents)} · {o.quantity} {o.unit}
                        {o.unitPriceCents != null && o.unitPriceBasis ? ` · ${formatCents(o.unitPriceCents)} per ${o.unitPriceBasis}` : ''}
                        {o.packageSize ? ` · ${o.packageSize}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {priceSourceLabel(o.source)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(o.observedAt)}</span>
                      {isPriceStale(o.observedAt) && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600">
                          May be outdated
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Details editor */}
          <section aria-label="Item details" className="rounded-xl border bg-card p-3 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="it-name">Name</Label>
                <Input id="it-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="it-namebn">Name in Bangla</Label>
                <Input id="it-namebn" value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="e.g. ইলিশ" />
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1">
                <div className="space-y-1.5">
                  <Label htmlFor="it-qty">Quantity</Label>
                  <Input id="it-qty" type="number" min="0.1" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="it-unit">Unit</Label>
                  <select id="it-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2.5 text-sm">
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="it-category">Category</Label>
                <select id="it-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2.5 text-sm">
                  {ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_EMOJI[c]} {CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="it-store">Store</Label>
                <select id="it-store" value={storeId} onChange={(e) => setStoreId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2.5 text-sm">
                  <option value="">List default</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="it-note">Note</Label>
                <Textarea id="it-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Brand, size, aisle…" />
              </div>
            </div>
            <Button onClick={() => void saveDetails()} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save details
            </Button>
          </section>

          {item.status === 'PURCHASED' && item.purchasedBy && (
            <p className="text-xs text-muted-foreground">
              Purchased by {item.purchasedBy.name} {item.purchasedAt ? timeAgo(item.purchasedAt) : ''}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t p-3 flex justify-between items-center">
          <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Remove item
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>

        {/* Ask Family dialog */}
        <Dialog open={askOpen} onOpenChange={setAskOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Ask family about “{item.name}”</DialogTitle>
              <DialogDescription>Attach a photo of the shelf — the family can confirm while you keep shopping.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ask-note">Note</Label>
                <Textarea
                  id="ask-note"
                  value={askNote}
                  onChange={(e) => setAskNote(e.target.value)}
                  rows={2}
                  placeholder="Is this the right one? Brand, size…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Photo (optional)</Label>
                <input
                  ref={askFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && void onPickAskPhoto(e.target.files[0])}
                />
                {askPhoto ? (
                  <div className="flex items-center gap-2">
                    <img src={askPhoto} alt="Attached" className="h-14 w-14 rounded-md border object-cover" />
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAskPhoto(null)}>
                      <X className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => askFileRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Attach photo
                  </Button>
                )}
              </div>
              <Button onClick={() => void sendAsk()} disabled={askBusy || (!askNote.trim() && !askPhoto)} className="w-full gap-1.5">
                {askBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send request
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Save price to Price Memory dialog */}
        <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Save current price</DialogTitle>
              <DialogDescription>for “{item.name}”</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-store">Store</Label>
                <select
                  id="pm-store"
                  value={priceStore}
                  onChange={(e) => setPriceStore(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-2.5 text-sm"
                >
                  <option value="">No store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pm-amount">Amount paid ($)</Label>
                  <Input
                    id="pm-amount"
                    inputMode="decimal"
                    placeholder="e.g. 3.48"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pm-package">Package size</Label>
                  <Input
                    id="pm-package"
                    value={pricePackage}
                    onChange={(e) => setPricePackage(e.target.value)}
                    placeholder="Optional, e.g. 12 oz"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pm-qty">Quantity</Label>
                  <Input
                    id="pm-qty"
                    type="number"
                    min="0.1"
                    step="any"
                    value={priceQty}
                    onChange={(e) => setPriceQty(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pm-unit">Unit</Label>
                  <select
                    id="pm-unit"
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-2.5 text-sm"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ShopNest remembers prices you enter — it is not a live price feed.
              </p>
              <Button onClick={() => void savePriceObservation()} disabled={addPrice.isPending} className="w-full gap-1.5">
                {addPrice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />} Save price
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* zoom */}
        <Dialog open={!!zoomPhoto} onOpenChange={(o) => !o && setZoomPhoto(null)}>
          <DialogContent className="sm:max-w-xl p-2">
            {zoomPhoto && (
              <img src={zoomPhoto} alt="Item photo enlarged" className="w-full rounded-lg" />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove “{item.name}”?</AlertDialogTitle>
              <AlertDialogDescription>Everyone in the household will see it removed from the list.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  deleteItem.mutate({ itemId: item.id })
                  onOpenChange(false)
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
