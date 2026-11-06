'use client'

import { useState } from 'react'
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, CalendarDays, MoreHorizontal, Trash2, CircleCheck, RotateCcw, Users, Wallet, Send, Minus } from 'lucide-react'
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useAddEventItem, useUpdateEventItem, useDeleteEventItem } from '@/lib/shopnest/hooks'
import { EVENT_TYPES, EVENT_TYPE_EMOJI, UNITS, CATEGORY_EMOJI } from '@/lib/shopnest/constants'
import type { Me, HouseholdEvent } from '@/lib/shopnest/types'

const TYPE_OPTIONS = EVENT_TYPES.map((t) => ({ value: t, label: `${EVENT_TYPE_EMOJI[t]} ${t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}` }))

export function PlannerView({ householdId, me }: { householdId: string; me: Me }) {
  const eventsQ = useEvents(householdId)
  const createEvent = useCreateEvent(householdId)
  const updateEvent = useUpdateEvent(householdId)
  const deleteEvent = useDeleteEvent(householdId)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('GATHERING')
  const [date, setDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<HouseholdEvent | null>(null)

  const events = eventsQ.data?.events ?? []
  const planning = events.filter((e) => e.status === 'PLANNING')
  const completed = events.filter((e) => e.status === 'COMPLETED')

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
          {planning.map((e) => (
            <EventCard key={e.id} event={e} householdId={householdId} onDelete={() => setDeleteConfirm(e)} />
          ))}
          {completed.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
              {completed.map((e) => (
                <EventCard key={e.id} event={e} householdId={householdId} onDelete={() => setDeleteConfirm(e)} compact />
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

function EventCard({
  event,
  householdId,
  onDelete,
  compact,
}: {
  event: HouseholdEvent
  householdId: string
  onDelete: () => void
  compact?: boolean
}) {
  const updateEvent = useUpdateEvent(householdId)
  const addEventItem = useAddEventItem(householdId)
  const updateEventItem = useUpdateEventItem(householdId)
  const deleteEventItem = useDeleteEventItem(householdId)

  const [itemName, setItemName] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemUnit, setItemUnit] = useState('pc')
  const doneCount = event.items.filter((i) => i.isDone).length
  const progress = event.items.length > 0 ? Math.round((doneCount / event.items.length) * 100) : 0

  const add = () => {
    const n = itemName.trim()
    if (!n) return
    addEventItem.mutate({ eventId: event.id, name: n, quantity: Math.max(Number(itemQty) || 1, 0.1), unit: itemUnit, category: 'OTHER' })
    setItemName('')
    setItemQty('1')
  }

  return (
    <Card className="py-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden>{EVENT_TYPE_EMOJI[event.type] ?? '📅'}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{event.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
              {event.date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              )}
              {event.guestCount != null && (
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {event.guestCount}</span>
              )}
              {event.budget != null && (
                <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> ${event.budget}</span>
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!compact && (
          <>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">{doneCount}/{event.items.length}</span>
            </div>

            {event.items.length > 0 && (
              <ul className="space-y-1">
                {event.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-0.5 group">
                    <Checkbox
                      checked={i.isDone}
                      onCheckedChange={(v) => updateEventItem.mutate({ id: i.id, patch: { isDone: v === true } })}
                      className="h-5 w-5 rounded-full shrink-0"
                      aria-label={`Mark ${i.name} done`}
                    />
                    <span className="text-sm shrink-0" aria-hidden>{CATEGORY_EMOJI[i.category] ?? '🛒'}</span>
                    <span className={`text-sm min-w-0 flex-1 truncate ${i.isDone ? 'line-through text-muted-foreground' : ''}`}>
                      {i.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{i.quantity} {i.unit}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={() => deleteEventItem.mutate({ id: i.id })}
                      aria-label={`Remove ${i.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-1.5">
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Add checklist item…"
                className="h-9"
                aria-label="Add event item"
              />
              <Input
                type="number"
                min="0.1"
                step="any"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                className="h-9 w-20 shrink-0"
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
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={add} disabled={!itemName.trim()} aria-label="Add checklist item">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
