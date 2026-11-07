'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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
import { Camera, Check, Trash2, Loader2, X, Send, ShoppingCart, CircleOff, Repeat, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useList, useUpdateItem, useDeleteItem, useAddComment, useAddPhoto, useDeletePhoto, useStores } from '@/lib/shopnest/hooks'
import { compressImageFile } from '@/lib/shopnest/compress'
import { CATEGORY_EMOJI, ITEM_CATEGORIES, CATEGORY_LABEL, UNITS } from '@/lib/shopnest/constants'
import { UserChip, timeAgo, StatusBadge } from '@/components/shopnest/ui-bits'
import type { Me, ItemComment } from '@/lib/shopnest/types'

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
  const storesQ = useStores(householdId)
  const updateItem = useUpdateItem(householdId)
  const deleteItem = useDeleteItem(householdId)
  const addComment = useAddComment(householdId)
  const addPhoto = useAddPhoto(householdId)
  const deletePhoto = useDeletePhoto(householdId)

  const item = (listQ.data?.list.items ?? []).find((i) => i.id === itemId) ?? null

  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('pc')
  const [note, setNote] = useState('')
  const [storeId, setStoreId] = useState('')
  const [category, setCategory] = useState('OTHER')
  const [comment, setComment] = useState('')
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setNameBn(item.nameBn ?? '')
      setQty(String(item.quantity))
      setUnit(item.unit)
      setNote(item.note ?? '')
      setStoreId(item.storeId ?? '')
      setCategory(item.category)
    }
  }, [item?.id, item?.updatedAt])

  const stores = storesQ.data?.stores ?? []

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

  const photos = item.photos ?? []
  const comments = item.comments ?? []

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

        <div className="flex-1 overflow-y-auto scrollbar-slim p-4 space-y-5">
          {/* Status actions */}
          <section aria-label="Status" className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={item.status === 'PURCHASED' ? 'default' : 'outline'}
              onClick={() => updateItem.mutate({ itemId: item.id, patch: { status: item.status === 'PURCHASED' ? 'PENDING' : 'PURCHASED' } })}
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
          </section>

          {/* Photos */}
          <section aria-label="Photos" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Photos & product check</h3>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
              />
              <Button size="sm" variant="outline" className="gap-1.5 h-8 shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
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
          <section aria-label="Comments" className="space-y-2">
            <h3 className="text-sm font-semibold">Discussion ({comments.length})</h3>
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

          {/* Details editor */}
          <section aria-label="Item details" className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">Details</h3>
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
            <Button onClick={saveDetails} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save details
            </Button>
          </section>

          {item.status === 'PURCHASED' && item.purchasedBy && (
            <p className="text-xs text-muted-foreground border-t pt-3">
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
