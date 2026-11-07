'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Search, Star } from 'lucide-react'
import { useAddItem, useProducts, useStores } from '@/lib/shopnest/hooks'
import { CATEGORY_EMOJI, ITEM_CATEGORIES, CATEGORY_LABEL, UNITS, SPECIALTY_CATALOG } from '@/lib/shopnest/constants'
import { useCatalogSearch, type CatalogEntry } from '@/lib/shopnest/hooks'
import type { HouseholdProduct } from '@/lib/shopnest/types'

export function AddItemDialog({
  open,
  onOpenChange,
  householdId,
  listId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  householdId: string
  listId: string
}) {
  const productsQ = useProducts(householdId)
  const storesQ = useStores(householdId)
  const addItem = useAddItem(householdId)

  const stores = storesQ.data?.stores ?? []
  const products = productsQ.data?.products ?? []

  const [tab, setTab] = useState<'custom' | 'saved'>('custom')
  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('pc')
  const [category, setCategory] = useState('OTHER')
  const [storeId, setStoreId] = useState('')
  const [note, setNote] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [search, setSearch] = useState('')

  const reset = () => {
    setName('')
    setNameBn('')
    setQty('1')
    setUnit('pc')
    setCategory('OTHER')
    setStoreId('')
    setNote('')
    setRecurring(false)
    setSearch('')
  }

  const submitCustom = () => {
    const n = name.trim()
    if (!n) return
    addItem.mutate(
      {
        listId,
        name: n,
        nameBn: nameBn.trim() || null,
        quantity: Math.max(Number(qty) || 1, 0.1),
        unit,
        category,
        storeId: storeId || null,
        note: note.trim() || null,
        isRecurring: recurring,
      },
      { onSuccess: () => { reset(); setTab('custom') } }
    )
  }

  const addProduct = (p: HouseholdProduct) => {
    addItem.mutate({
      listId,
      name: p.name,
      nameBn: p.nameBn,
      quantity: p.defaultQty,
      unit: p.unit,
      category: p.category,
      storeId: p.storeId,
      favoriteProductId: p.id,
      isRecurring: p.isRecurring,
    })
  }

  const addFromCatalog = (entry: {
    name: string
    nameBn?: string
    category: string
    defaultQty: number
    unit: string
    preferredStoreCategory?: string
  }) => {
    // auto-save to household catalog so it becomes a one-tap favorite next time
    addItem.mutate(
      {
        listId,
        name: entry.name,
        nameBn: entry.nameBn ?? null,
        quantity: entry.defaultQty,
        unit: entry.unit,
        category: entry.category,
      },
      { onSuccess: () => {} }
    )
  }

  // V2 Feature Five — alias-aware search: English, Bangla, transliteration and
  // curated aliases all resolve to the same canonical product ("ilish" → Hilsa).
  const q = search.trim().toLowerCase()
  const houseMatch = (p: (typeof products)[number]) => {
    let aliases: string[] = []
    try {
      aliases = p.aliases ? JSON.parse(p.aliases as unknown as string) : []
    } catch { aliases = [] }
    return p.name.toLowerCase().includes(q) || (p.nameBn ?? '').includes(q) || aliases.some((a) => a.toLowerCase().includes(q))
  }
  const catalogMatch = (e: CatalogEntry) =>
    e.name.toLowerCase().includes(q) || (e.nameBn ?? '').includes(q) || (e.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  const filteredProducts = q ? products.filter(houseMatch) : products
  const filteredCatalog: CatalogEntry[] = q ? SPECIALTY_CATALOG.filter(catalogMatch) : SPECIALTY_CATALOG
  // server-side search catches transliteration variants beyond curated aliases
  const catalogSearch = useCatalogSearch(q.length >= 2 ? q : '', householdId)
  const extraCatalog = (catalogSearch.data?.catalog ?? []).filter(
    (e) => !filteredCatalog.some((f) => f.name === e.name)
  ).slice(0, 8)

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle>Add items</DialogTitle>
          <DialogDescription>Use saved essentials, the specialty catalog, or add anything custom.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'custom' | 'saved')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="custom">Custom item</TabsTrigger>
            <TabsTrigger value="saved">Saved & catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-name">Name</Label>
                <Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cooking oil" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-namebn">Name in Bangla (optional)</Label>
                <Input id="ai-namebn" value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="e.g. তেল" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-qty">Quantity</Label>
                  <Input id="ai-qty" type="number" min="0.1" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-unit">Unit</Label>
                  <select id="ai-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2.5 text-sm">
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-category">Category</Label>
                <select id="ai-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2.5 text-sm">
                  {ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_EMOJI[c]} {CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-store">Store</Label>
                <select id="ai-store" value={storeId} onChange={(e) => setStoreId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2.5 text-sm">
                  <option value="">List default</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-note">Note (optional)</Label>
              <Textarea id="ai-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brand, size, aisle…" rows={2} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(v === true)} />
              Mark as a recurring essential
            </label>
          </TabsContent>

          <TabsContent value="saved" className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search saved items & catalog…" className="pl-8" />
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-slim space-y-1 -mx-1 px-1">
              {filteredProducts.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Household favorites</p>
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      className="w-full flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/50 transition-colors text-left"
                      onClick={() => addProduct(p)}
                    >
                      <span aria-hidden>{CATEGORY_EMOJI[p.category] ?? '🛒'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        {p.nameBn && <span className="block text-xs text-muted-foreground">{p.nameBn}</span>}
                      </span>
                      {p.isRecurring && <Star className="h-3.5 w-3.5 text-primary fill-primary" />}
                      <span className="text-xs text-muted-foreground">{p.defaultQty} {p.unit}</span>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </>
              )}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                Specialty catalog · Bangladeshi, halal & staples
              </p>
              <p className="text-[11px] text-muted-foreground">
                Halal tags reflect how your household shops — ShopNest never claims certification.
              </p>
              {filteredCatalog.map((entry) => (
                <button
                  key={entry.name}
                  className="w-full flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/50 transition-colors text-left"
                  onClick={() => addFromCatalog(entry)}
                >
                  <span aria-hidden>{CATEGORY_EMOJI[entry.category] ?? '🛒'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entry.name}</span>
                    {entry.nameBn && <span className="block text-xs text-muted-foreground">{entry.nameBn}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.defaultQty} {entry.unit}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {extraCatalog.map((entry) => (
                <button
                  key={`srv-${entry.name}`}
                  type="button"
                  className="w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => addFromCatalog(entry)}
                >
                  <span className="text-xl" aria-hidden>{CATEGORY_EMOJI[entry.category] ?? '🛒'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{entry.name}</span>
                    {entry.nameBn && <span className="block text-xs text-muted-foreground">{entry.nameBn}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{entry.defaultQty} {entry.unit}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && filteredCatalog.length === 0 && extraCatalog.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nothing matches “{search}”.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {tab === 'custom' && (
            <Button onClick={submitCustom} disabled={!name.trim() || addItem.isPending}>
              Add to list
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
