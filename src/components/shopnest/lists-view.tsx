'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Trash2, ListChecks, Store as StoreIcon, MoreHorizontal, Pencil, CircleCheck, RotateCcw } from 'lucide-react'
import { useLists, useCreateList, useDeleteList, useUpdateList, useStores } from '@/lib/shopnest/hooks'
import { STORE_CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import type { Me, ShoppingList } from '@/lib/shopnest/types'
import { ListDetail } from '@/components/shopnest/list-detail'

export function ListsView({ householdId, me, onStartShopping }: { householdId: string; me: Me; onStartShopping?: (listId?: string | null) => void }) {
  const listsQ = useLists(householdId)
  const storesQ = useStores(householdId)
  const createList = useCreateList(householdId)
  const deleteList = useDeleteList(householdId)
  const updateList = useUpdateList(householdId)

  const [explicitListId, setExplicitListId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🛒')
  const [newStoreId, setNewStoreId] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<ShoppingList | null>(null)

  const lists = listsQ.data?.lists ?? []
  const stores = storesQ.data?.stores ?? []

  // Deep-link support: /?list=<id> opens the shared list directly.
  // Read once on first client render; navigating back clears the query param
  // (an external-system update, done in the handler — no effect needed).
  const [urlListId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('list')
  })
  const openListId = explicitListId ?? urlListId
  const openList = lists.find((l) => l.id === openListId) ?? null

  const closeList = () => {
    setExplicitListId(null)
    const url = new URL(window.location.href)
    if (url.searchParams.has('list')) {
      url.searchParams.delete('list')
      window.history.replaceState(null, '', url.toString())
    }
  }

  const create = () => {
    if (!newName.trim()) return
    createList.mutate(
      { name: newName.trim(), emoji: newEmoji || '🛒', storeId: newStoreId || null },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setNewName('')
          setNewStoreId('')
        },
      }
    )
  }

  if (openList) {
    return <ListDetail listId={openList.id} me={me} householdId={householdId} onBack={closeList} onStartShopping={onStartShopping} />
  }

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Shopping lists</h1>
          <p className="text-sm text-muted-foreground">Shared with your household — updates in real time.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 h-9 shrink-0">
          <Plus className="h-4 w-4" /> New list
        </Button>
      </div>

      {listsQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Create a list for your weekly shop, each store, or an event.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create your first list
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => {
            const done = (l.counts?.purchased ?? 0) > 0 && (l.counts?.pending ?? 0) === 0
            const progress =
              l.counts && l.counts.total > 0
                ? Math.round(((l.counts.purchased + l.counts.unavailable) / l.counts.total) * 100)
                : 0
            return (
              <Card
                key={l.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:border-primary/50 transition-colors py-0 overflow-hidden"
                onClick={() => setExplicitListId(l.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExplicitListId(l.id)
                  }
                }}
                aria-label={`Open list ${l.name}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none mt-0.5" aria-hidden>{l.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{l.name}</h3>
                        {done && <Badge variant="secondary" className="shrink-0">Done</Badge>}
                        {l.status === 'COMPLETED' && !done && (
                          <Badge variant="outline" className="shrink-0">Completed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                        {l.store ? (
                          <>
                            <span aria-hidden>{STORE_CATEGORY_EMOJI[l.store.category] ?? '🏬'}</span>
                            {l.store.name}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1"><StoreIcon className="h-3 w-3" /> No store</span>
                        )}
                        <span aria-hidden>·</span>
                        <span>{l.counts?.pending ?? 0} to buy</span>
                      </p>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden" aria-hidden>
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {l.counts ? `${l.counts.total - l.counts.pending}/${l.counts.total}` : '0/0'}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${l.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={() => {
                            const name = window.prompt('Rename list', l.name)
                            if (name && name.trim()) updateList.mutate({ listId: l.id, name: name.trim() })
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateList.mutate({ listId: l.id, status: l.status === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED' })
                          }
                        >
                          {l.status === 'COMPLETED' ? (
                            <><RotateCcw className="mr-2 h-4 w-4" /> Reopen list</>
                          ) : (
                            <><CircleCheck className="mr-2 h-4 w-4" /> Mark completed</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(l)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete list
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New shopping list</DialogTitle>
            <DialogDescription>Everyone in the household can see and edit this list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                className="h-10 w-16 rounded-md border bg-background text-center text-lg"
                aria-label="List emoji"
              >
                {['🛒', '🥕', '🕌', '🐟', '🎂', '🧹', '💊', '🍼', '🎓', '🏠'].map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Weekly Groceries"
                onKeyDown={(e) => e.key === 'Enter' && create()}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="list-store">Default store (optional)</label>
              <select
                id="list-store"
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No store</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={!newName.trim() || createList.isPending}>Create list</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleteConfirm?.name}”?</DialogTitle>
            <DialogDescription>
              This removes the list and all its items for everyone in the household. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) deleteList.mutate({ listId: deleteConfirm.id })
                setDeleteConfirm(null)
                setExplicitListId(null)
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
