'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  CalendarDays,
  MoreHorizontal,
  Trash2,
  CircleCheck,
  RotateCcw,
  Users,
  Wallet,
  Send,
  Minus,
  AlarmClock,
  BookmarkPlus,
  CircleDollarSign,
  Copy,
  Link2,
  ListChecks,
  ListPlus,
  Sparkles,
  Store as StoreIcon,
  UserPlus,
} from 'lucide-react'
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useAddEventItem,
  useUpdateEventItem,
  useDeleteEventItem,
  useDuplicateEvent,
  useCopyEventToList,
  useLists,
  useStores,
  useHousehold,
  useBudgets,
  type BudgetT,
} from '@/lib/shopnest/hooks'
import { EVENT_TYPES, EVENT_TYPE_EMOJI, UNITS, CATEGORY_EMOJI, STORE_CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import { formatCents } from '@/lib/shopnest/money'
import { UserChip } from '@/components/shopnest/ui-bits'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { Me, HouseholdEvent, EventItemT, Member, Store } from '@/lib/shopnest/types'

/**
 * Wire shape note: the events API returns raw Prisma rows, so every scalar
 * field is present on each event/item — including the V2 `isTemplate`,
 * `assignedToId` and `shoppingItemId` columns — even though the shared
 * `HouseholdEvent` type predates V2. We extend the shared type locally here
 * (the `assignedTo` user relation is not included by the API, so assignee
 * identity is resolved from the household members below).
 */
type PlannerEvent = Omit<HouseholdEvent, 'items'> & { isTemplate?: boolean; items: EventItemT[] }

const TYPE_OPTIONS = EVENT_TYPES.map((t) => ({ value: t, label: `${EVENT_TYPE_EMOJI[t]} ${t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}` }))

// ─── small helpers ───────────────────────────────────────────────────────────

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isOverdue(e: PlannerEvent): boolean {
  return e.status !== 'COMPLETED' && !!e.date && new Date(e.date).getTime() < startOfToday()
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Event budgets are Float dollars (not cents). */
function formatDollars(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function todayLocalISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function stripTemplateSuffix(name: string): string {
  return name.replace(/\s*\(template\)\s*$/i, '').trim() || name
}

// ─── main view ───────────────────────────────────────────────────────────────

export function PlannerView({ householdId, me }: { householdId: string; me: Me }) {
  const eventsQ = useEvents(householdId)
  const householdQ = useHousehold(householdId)
  const storesQ = useStores(householdId)
  const listsQ = useLists(householdId)
  const budgetsQ = useBudgets(householdId)
  const createEvent = useCreateEvent(householdId)
  const updateEvent = useUpdateEvent(householdId)
  const deleteEvent = useDeleteEvent(householdId)
  const duplicateEvent = useDuplicateEvent(householdId)
  const copyToList = useCopyEventToList(householdId)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('GATHERING')
  const [date, setDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<PlannerEvent | null>(null)

  // "Use template" dialog state
  const [useTpl, setUseTpl] = useState<PlannerEvent | null>(null)
  const [tplName, setTplName] = useState('')
  const [tplDate, setTplDate] = useState('')

  // "Copy to shopping list" dialog state
  const [copyTarget, setCopyTarget] = useState<PlannerEvent | null>(null)
  const [copyListId, setCopyListId] = useState('')

  const events = (eventsQ.data?.events ?? []) as unknown as PlannerEvent[]
  const planning = events.filter((e) => e.status === 'PLANNING' && !e.isTemplate)
  const completed = events.filter((e) => e.status === 'COMPLETED' && !e.isTemplate)
  const templates = events.filter((e) => e.isTemplate === true)

  const members = householdQ.data?.household.members ?? []
  const stores = storesQ.data?.stores ?? []
  const activeLists = (listsQ.data?.lists ?? []).filter((l) => l.status === 'ACTIVE')

  /** EVENT-scoped budget per event → honest "Spent" stat (tracked by the budgets feature). */
  const eventBudgets = useMemo(() => {
    const m = new Map<string, BudgetT>()
    for (const b of budgetsQ.data?.budgets ?? []) {
      if (b.scope === 'EVENT' && b.eventId) m.set(b.eventId, b)
    }
    return m
  }, [budgetsQ.data])

  const submitCreate = () => {
    const n = name.trim()
    if (!n) return
    createEvent.mutate(
      {
        name: n,
        type,
        date: date || null,
        guestCount: guestCount ? Number(guestCount) : null,
        budget: budget ? Number(budget) : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setName('')
          setDate('')
          setGuestCount('')
          setBudget('')
          setNotes('')
        },
      }
    )
  }

  const openUseTemplate = (t: PlannerEvent) => {
    setUseTpl(t)
    setTplName(stripTemplateSuffix(t.name))
    setTplDate(todayLocalISO())
  }

  /** "Use template": duplicate as a fresh event, then apply the chosen deadline. */
  const submitUseTemplate = () => {
    if (!useTpl) return
    const n = tplName.trim()
    if (!n) return
    const newDate = tplDate || null
    duplicateEvent.mutate(
      { eventId: useTpl.id, name: n, asTemplate: false },
      {
        onSuccess: (res) => {
          // Duplicating copies the template's date — apply the user's choice.
          if (res.event?.id) updateEvent.mutate({ id: res.event.id, patch: { date: newDate } })
          setUseTpl(null)
        },
      }
    )
  }

  const openCopy = (e: PlannerEvent) => {
    setCopyTarget(e)
    setCopyListId(activeLists[0]?.id ?? '')
  }

  const submitCopy = () => {
    if (!copyTarget || !copyListId) return
    copyToList.mutate(
      { eventId: copyTarget.id, listId: copyListId },
      {
        onSuccess: (res) => {
          toast({
            description:
              res.copied === 0
                ? `Nothing new to copy — ${res.skipped} already linked`
                : `Copied ${res.copied} item${res.copied === 1 ? '' : 's'} (${res.skipped} already linked)`,
          })
          setCopyTarget(null)
        },
      }
    )
  }

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Planner</h1>
          <p className="text-sm text-muted-foreground">Birthdays, Eid, dinners and barbecues — plan the shopping together.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 h-9 shrink-0">
          <Plus className="h-4 w-4" /> New event
        </Button>
      </div>

      {eventsQ.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Plan an event with a checklist, budget and store assignments.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Plan your first event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {planning.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing being planned right now — start from a template below or create an event.
            </p>
          )}
          {planning.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              householdId={householdId}
              members={members}
              stores={stores}
              eventBudget={eventBudgets.get(e.id)}
              onDelete={() => setDeleteConfirm(e)}
              onCopy={() => openCopy(e)}
              onDuplicate={() => duplicateEvent.mutate({ eventId: e.id, asTemplate: false })}
              onSaveTemplate={() => duplicateEvent.mutate({ eventId: e.id, asTemplate: true })}
            />
          ))}

          {templates.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 uppercase tracking-wide">
                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Templates
              </h2>
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={() => openUseTemplate(t)} onDelete={() => setDeleteConfirm(t)} />
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
              {completed.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  householdId={householdId}
                  members={members}
                  stores={stores}
                  eventBudget={eventBudgets.get(e.id)}
                  onDelete={() => setDeleteConfirm(e)}
                  onCopy={() => openCopy(e)}
                  onDuplicate={() => duplicateEvent.mutate({ eventId: e.id, asTemplate: false })}
                  onSaveTemplate={() => duplicateEvent.mutate({ eventId: e.id, asTemplate: true })}
                  compact
                />
              ))}
            </section>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plan an event</DialogTitle>
            <DialogDescription>Build the shopping checklist together with the household.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-name">Event name</Label>
              <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid family dinner" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-type">Type</Label>
                <select id="ev-type" value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-date">Date</Label>
                <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-guests">Guests</Label>
                <Input id="ev-guests" type="number" min="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="12" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-budget">Budget ($)</Label>
                <Input id="ev-budget" type="number" min="0" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="250" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-notes">Notes</Label>
              <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Menu ideas, who brings what…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={!name.trim() || createEvent.isPending}>Create event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use template dialog */}
      <Dialog open={!!useTpl} onOpenChange={(o) => !o && setUseTpl(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Use template</DialogTitle>
            <DialogDescription>
              Creates a fresh event with the “{useTpl?.name}” checklist — items, stores and assignees included.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Event name</Label>
              <Input id="tpl-name" value={tplName} onChange={(e) => setTplName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-date">
                Shopping deadline <span className="font-normal text-muted-foreground">(defaults to today)</span>
              </Label>
              <Input id="tpl-date" type="date" value={tplDate} onChange={(e) => setTplDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseTpl(null)}>Cancel</Button>
            <Button onClick={submitUseTemplate} disabled={!tplName.trim() || duplicateEvent.isPending}>
              <Sparkles className="mr-1 h-4 w-4" /> Create from template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy to shopping list dialog */}
      <Dialog open={!!copyTarget} onOpenChange={(o) => !o && setCopyTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Copy to shopping list</DialogTitle>
            <DialogDescription>
              Checklist items from “{copyTarget?.name}” will be added to the list. Items already linked are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="copy-list">Shopping list</Label>
            <select
              id="copy-list"
              value={copyListId}
              onChange={(e) => setCopyListId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {activeLists.length === 0 && <option value="">No active lists</option>}
              {activeLists.map((l) => (
                <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>
              ))}
            </select>
            {activeLists.length === 0 && (
              <p className="text-xs text-muted-foreground">Create a list first from the Lists tab.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyTarget(null)}>Cancel</Button>
            <Button onClick={submitCopy} disabled={!copyListId || copyToList.isPending}>
              <ListPlus className="mr-1 h-4 w-4" /> Copy items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog (events & templates) */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleteConfirm?.name}”?</DialogTitle>
            <DialogDescription>The event and its checklist will be removed for everyone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) deleteEvent.mutate({ id: deleteConfirm.id })
                setDeleteConfirm(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── event card ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  householdId,
  members,
  stores,
  eventBudget,
  onDelete,
  onCopy,
  onDuplicate,
  onSaveTemplate,
  compact,
}: {
  event: PlannerEvent
  householdId: string
  members: Member[]
  stores: Store[]
  eventBudget?: BudgetT
  onDelete: () => void
  onCopy: () => void
  onDuplicate: () => void
  onSaveTemplate: () => void
  compact?: boolean
}) {
  const updateEvent = useUpdateEvent(householdId)
  const addEventItem = useAddEventItem(householdId)
  const updateEventItem = useUpdateEventItem(householdId)
  const deleteEventItem = useDeleteEventItem(householdId)

  const [itemName, setItemName] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemUnit, setItemUnit] = useState('pc')
  const [itemStoreId, setItemStoreId] = useState('')

  const total = event.items.length
  const doneCount = event.items.filter((i) => i.isDone).length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const overdue = isOverdue(event)

  // Assignee identity: the API doesn't embed the assignedTo user, resolve from members.
  const membersById = useMemo(() => {
    const m = new Map<string, Member['user']>()
    for (const mem of members) m.set(mem.user.id, mem.user)
    return m
  }, [members])

  const spentCents = eventBudget?.spendCents
  const overBudget = event.budget != null && spentCents != null && spentCents > event.budget * 100

  const add = () => {
    const n = itemName.trim()
    if (!n) return
    const storeId = itemStoreId || null
    addEventItem.mutate(
      { eventId: event.id, name: n, quantity: Math.max(Number(itemQty) || 1, 0.1), unit: itemUnit, category: 'OTHER' },
      {
        onSuccess: (res) => {
          // The add-item hook doesn't forward storeId — patch it onto the new item.
          const created = (res as { item?: { id: string } } | undefined)?.item
          if (storeId && created?.id) updateEventItem.mutate({ id: created.id, patch: { storeId } })
        },
      }
    )
    setItemName('')
    setItemQty('1')
    setItemStoreId('')
  }

  return (
    <Card className="py-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl',
              event.isTemplate ? 'bg-violet-500/15' : 'bg-primary/10'
            )}
            aria-hidden
          >
            {EVENT_TYPE_EMOJI[event.type] ?? '📅'}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{event.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
              {overdue ? (
                <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600">
                  <AlarmClock className="h-3 w-3" aria-hidden />
                  Overdue — was {fmtShortDate(event.date as string)}
                </Badge>
              ) : event.date ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" aria-hidden />
                  {event.status === 'PLANNING' ? `by ${fmtShortDate(event.date)}` : fmtFullDate(event.date)}
                </span>
              ) : null}
              {event.guestCount != null && (
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden /> {event.guestCount}</span>
              )}
              {compact && event.budget != null && (
                <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" aria-hidden /> {formatDollars(event.budget)}</span>
              )}
            </p>
            {event.notes && !compact && <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!compact && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => updateEvent.mutate({ id: event.id, patch: { status: 'COMPLETED' } })}
              >
                <CircleCheck className="h-4 w-4" /> Done
              </Button>
            )}
            {event.status === 'COMPLETED' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => updateEvent.mutate({ id: event.id, patch: { status: 'PLANNING' } })}
              >
                <RotateCcw className="h-4 w-4" /> Reopen
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${event.name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onCopy}>
                  <ListPlus className="mr-2 h-4 w-4" /> Copy to shopping list…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate event
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSaveTemplate}>
                  <BookmarkPlus className="mr-2 h-4 w-4" /> Save as template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!compact && (
          <>
            {/* Budget + checklist progress panel */}
            <div className="rounded-xl bg-muted/40 p-2.5 space-y-2">
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs">
                {event.budget != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden />
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-semibold tabular-nums">{formatDollars(event.budget)}</span>
                  </span>
                )}
                {spentCents != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <CircleDollarSign className={cn('h-3.5 w-3.5', overBudget ? 'text-amber-500' : 'text-muted-foreground')} aria-hidden />
                    <span className="text-muted-foreground">Spent</span>
                    <span className={cn('font-semibold tabular-nums', overBudget && 'text-amber-600')}>{formatCents(spentCents)}</span>
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  Checklist progress
                  <span className="font-semibold text-foreground tabular-nums">{doneCount}/{total}</span>
                </span>
              </div>
              <Progress value={progress} className="h-1.5" aria-label={`Checklist progress for ${event.name}`} />
            </div>

            {event.items.length > 0 && (
              <ul className="space-y-0.5">
                {event.items.map((i) => {
                  const assignee = i.assignedTo ?? (i.assignedToId ? membersById.get(i.assignedToId) : undefined)
                  const store = i.store ?? (i.storeId ? stores.find((s) => s.id === i.storeId) : undefined)
                  return (
                    <li key={i.id} className="group flex items-center gap-2 py-1">
                      <Checkbox
                        checked={i.isDone}
                        onCheckedChange={(v) => updateEventItem.mutate({ id: i.id, patch: { isDone: v === true } })}
                        className="h-5 w-5 rounded-full shrink-0"
                        aria-label={`Mark ${i.name} done`}
                      />
                      <span className="text-sm shrink-0" aria-hidden>{CATEGORY_EMOJI[i.category] ?? '🛒'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className={cn('text-sm min-w-0 truncate', i.isDone && 'line-through text-muted-foreground')}>
                            {i.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{i.quantity} {i.unit}</span>
                        </div>
                        {(store || i.shoppingItemId) && (
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {/* Per-item store: badge doubles as the store picker trigger */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                {store ? (
                                  <button
                                    className="inline-flex max-w-36 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                                    aria-label={`Store ${store.name} — change`}
                                  >
                                    <StoreIcon className="h-3 w-3 shrink-0" aria-hidden />
                                    <span className="truncate">{store.name}</span>
                                  </button>
                                ) : (
                                  <button
                                    className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                                    aria-label={`Set store for ${i.name}`}
                                  >
                                    <Plus className="h-3 w-3 shrink-0" aria-hidden /> Store
                                  </button>
                                )}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto scrollbar-slim">
                                <DropdownMenuLabel>Store</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem
                                  checked={!i.storeId}
                                  onCheckedChange={() => updateEventItem.mutate({ id: i.id, patch: { storeId: null } })}
                                >
                                  No store
                                </DropdownMenuCheckboxItem>
                                {stores.map((s) => (
                                  <DropdownMenuCheckboxItem
                                    key={s.id}
                                    checked={i.storeId === s.id}
                                    onCheckedChange={() => updateEventItem.mutate({ id: i.id, patch: { storeId: s.id } })}
                                  >
                                    <span aria-hidden>{STORE_CATEGORY_EMOJI[s.category] ?? '🏬'}</span> {s.name}
                                  </DropdownMenuCheckboxItem>
                                ))}
                                {stores.length === 0 && (
                                  <DropdownMenuItem disabled>Add stores in the Stores tab first</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {i.shoppingItemId && (
                              <Badge variant="outline" className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-600">
                                <Link2 className="h-3 w-3" aria-hidden /> On list
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Assignee chip: avatar when assigned, tap to assign/clear */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
                            aria-label={assignee ? `Assigned to ${assignee.name} — change` : `Assign ${i.name} to someone`}
                          >
                            {assignee ? (
                              <UserChip name={assignee.name} color={assignee.avatarColor} size={24} />
                            ) : (
                              <UserPlus className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto scrollbar-slim">
                          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                          <DropdownMenuCheckboxItem
                            checked={!i.assignedToId}
                            onCheckedChange={() => updateEventItem.mutate({ id: i.id, patch: { assignedToId: null } })}
                          >
                            <UserPlus className="h-4 w-4" aria-hidden /> No one
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {members
                            .filter((m) => !m.user.isSuspended)
                            .map((m) => (
                              <DropdownMenuCheckboxItem
                                key={m.user.id}
                                checked={i.assignedToId === m.user.id}
                                onCheckedChange={() => updateEventItem.mutate({ id: i.id, patch: { assignedToId: m.user.id } })}
                              >
                                <UserChip name={m.user.name} color={m.user.avatarColor} size={18} className="mr-1" />
                                {m.user.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                          {members.length === 0 && <DropdownMenuItem disabled>No household members</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => deleteEventItem.mutate({ id: i.id })}
                        aria-label={`Remove ${i.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex flex-col sm:flex-row gap-1.5">
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Add checklist item…"
                className="h-9 flex-1"
                aria-label="Add event item"
              />
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min="0.1"
                  step="any"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  className="h-9 w-16 shrink-0"
                  aria-label="Quantity"
                />
                <select
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value)}
                  className="h-9 w-20 rounded-md border bg-background px-2 text-sm shrink-0"
                  aria-label="Unit"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <select
                  value={itemStoreId}
                  onChange={(e) => setItemStoreId(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                  aria-label="Store (optional)"
                >
                  <option value="">No store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {STORE_CATEGORY_EMOJI[s.category] ?? '🏬'} {s.name}
                    </option>
                  ))}
                </select>
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={add} disabled={!itemName.trim()} aria-label="Add checklist item">
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── template card ───────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: PlannerEvent
  onUse: () => void
  onDelete: () => void
}) {
  return (
    <Card className="py-0 border-violet-500/30">
      <CardContent className="p-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-xl" aria-hidden>
          {EVENT_TYPE_EMOJI[template.type] ?? '📅'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{template.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
            <span>{template.items.length} item{template.items.length === 1 ? '' : 's'}</span>
            {template.guestCount != null && (
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden /> {template.guestCount}</span>
            )}
            {template.budget != null && (
              <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" aria-hidden /> {formatDollars(template.budget)}</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-9 shrink-0 border-violet-500/40 text-violet-600 hover:bg-violet-500/10 hover:text-violet-600"
          onClick={onUse}
        >
          <Sparkles className="h-4 w-4" aria-hidden /> Use
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for template ${template.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onUse}>
              <Sparkles className="mr-2 h-4 w-4" /> Use template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  )
}
