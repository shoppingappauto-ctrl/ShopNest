'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Star, MapPin, Navigation, MoreHorizontal, Trash2, Pencil, Store as StoreIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStores, useCreateStore, useUpdateStore, useDeleteStore, useOutstanding } from '@/lib/shopnest/hooks'
import { STORE_CATEGORIES, STORE_CATEGORY_EMOJI, WELL_KNOWN_STORES } from '@/lib/shopnest/constants'
import type { Me, Store as StoreT } from '@/lib/shopnest/types'

const CATEGORY_OPTIONS = STORE_CATEGORIES.map((c) => ({ value: c, label: `${STORE_CATEGORY_EMOJI[c]} ${labelFor(c)}` }))

function labelFor(c: string): string {
  return c.charAt(0) + c.slice(1).toLowerCase().replace('_', ' ')
}

export function StoresView({ householdId, me }: { householdId: string; me: Me }) {
  const storesQ = useStores(householdId)
  const createStore = useCreateStore(householdId)
  const updateStore = useUpdateStore(householdId)
  const deleteStore = useDeleteStore(householdId)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('SUPERMARKET')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<StoreT | null>(null)
  const [editStore, setEditStore] = useState<StoreT | null>(null)

  const stores = storesQ.data?.stores ?? []
  const suggestions = WELL_KNOWN_STORES.filter(
    (s) => !stores.some((st) => st.name.toLowerCase() === s.toLowerCase())
  )

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

      {/* Outstanding by store */}
      <OutstandingByStore householdId={householdId} />

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
          {stores.map((s) => (
            <Card key={s.id} className="py-0">
              <CardContent className="p-4 space-y-2">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateStore.mutate({ id: s.id, patch: { isFavorite: !s.isFavorite } })}
                      aria-label={s.isFavorite ? 'Unfavorite store' : 'Favorite store'}
                      className="p-1.5"
                    >
                      <Star className={cn('h-4.5 w-4.5 h-[18px] w-[18px]', s.isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground')} />
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
                <p className="text-xs text-muted-foreground">
                  {s._count?.items ?? 0} outstanding item{(s._count?.items ?? 0) === 1 ? '' : 's'} · {s._count?.lists ?? 0} list{(s._count?.lists ?? 0) === 1 ? '' : 's'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

/** “All outstanding items across stores” — grouped pending items per store. */
function OutstandingByStore({ householdId }: { householdId: string }) {
  const { data, isLoading } = useOutstanding(householdId)
  const groups = data?.groups ?? []
  if (isLoading) return <Skeleton className="h-16" />
  if (groups.length === 0) return null

  return (
    <section aria-label="Outstanding items by store" className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding items by store</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.storeId} className="rounded-xl border bg-card p-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <span aria-hidden>{STORE_CATEGORY_EMOJI[g.category] ?? '🏬'}</span> {g.storeName}
              <Badge variant="secondary" className="ml-auto">{g.items.length}</Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {g.items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(' · ')}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
