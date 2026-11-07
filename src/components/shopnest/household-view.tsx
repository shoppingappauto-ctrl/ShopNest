'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Copy, RefreshCcw, LogOut, Plus, Users, Crown, Shield, MoreHorizontal, Home, UserMinus, Sparkles, Trash2, HeartHandshake } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useMe,
  useHousehold,
  useCreateHousehold,
  useJoinHousehold,
  useRegenerateInvite,
  useUpdateMemberRole,
  useRemoveMember,
  useLeaveHousehold,
  useRenameHousehold,
  useDeleteAccount,
} from '@/lib/shopnest/hooks'
import { api } from '@/lib/shopnest/client'
import { toast } from '@/hooks/use-toast'
import { UserChip, timeAgo } from '@/components/shopnest/ui-bits'
import { PlusDialog } from '@/components/shopnest/plus-dialog'
import type { Tab } from '@/components/shopnest/app-shell'
import { useUpdatePrefs } from '@/lib/shopnest/hooks'

export function HouseholdView({
  tab,
  setTab,
  needsHousehold,
}: {
  tab: Tab
  setTab: (t: Tab) => void
  needsHousehold?: boolean
}) {
  void tab
  return <HouseholdSettings needsHousehold={needsHousehold} setTab={setTab} />
}

function HouseholdSettings({ needsHousehold, setTab }: { needsHousehold?: boolean; setTab: (t: Tab) => void }) {
  const meQ = useMe()
  const me = meQ.data?.user
  const households = meQ.data?.households ?? []

  // V2: consume the pending invite saved by the auth screen deep link (?invite=SN-XXXXXX)
  const [pendingInvite] = useState(() => {
    if (typeof window === 'undefined') return null
    const v = window.localStorage.getItem('shopnest_pending_invite')
    return v && /^SN-[A-Z0-9]{6}$/i.test(v) ? v.toUpperCase() : null
  })
  const [inviteCode, setInviteCode] = useState(pendingInvite ?? '')
  useEffect(() => {
    if (pendingInvite) window.localStorage.removeItem('shopnest_pending_invite')
  }, [pendingInvite])
  const [joinOpen, setJoinOpen] = useState(!!pendingInvite)
  const [createOpen, setCreateOpen] = useState(needsHousehold)
  const [newName, setNewName] = useState('')
  const [leaveConfirm, setLeaveConfirm] = useState<string | null>(null)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)

  // V2: notification preferences are persisted to the server (was decorative state)
  const updatePrefs = useUpdatePrefs()
  const myPrefs = (() => {
    try {
      const parsed = me?.notifyPrefs ? JSON.parse(me.notifyPrefs) : {}
      return { reminders: true, comments: true, purchases: true, ...parsed }
    } catch {
      return { reminders: true, comments: true, purchases: true }
    }
  })()
  const [notifyList, setNotifyList] = useState(myPrefs.reminders)
  const [notifyPurchases, setNotifyPurchases] = useState(myPrefs.purchases)
  const [notifyEvents, setNotifyEvents] = useState(myPrefs.comments)
  const [largeText, setLargeText] = useState(me?.largeText ?? false)

  const createHousehold = useCreateHousehold()
  const joinHousehold = useJoinHousehold()
  const regenerateInvite = useRegenerateInvite('') // bound per household below
  void regenerateInvite
  const updateMemberRole = useUpdateMemberRole('')
  void updateMemberRole

  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null)
  const effectiveId =
    activeHouseholdId ??
    (typeof window !== 'undefined' ? window.localStorage.getItem('shopnest_active_household') : null) ??
    households[0]?.id ??
    null
  const householdQ = useHousehold(effectiveId ?? undefined)
  const household = householdQ.data?.household

  const regenerate = useRegenerateInvite(effectiveId ?? '')
  const changeRole = useUpdateMemberRole(effectiveId ?? '')
  const removeMember = useRemoveMember(effectiveId ?? '')
  const leaveHousehold = useLeaveHousehold()
  const renameHousehold = useRenameHousehold(effectiveId ?? '')
  const deleteAccount = useDeleteAccount()

  const myRole = households.find((h) => h.id === effectiveId)?.role
  const isManager = myRole === 'OWNER' || myRole === 'ADMIN'

  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ description: `${label} copied` }))
      .catch(() => {})
  }

  if (meQ.isLoading) {
    return (
      <div className="p-4 sm:p-0 space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Household</h1>
        <p className="text-sm text-muted-foreground">Members, invitations, plan and preferences.</p>
      </div>

      {/* Household switcher cards */}
      <section className="space-y-2" aria-label="Your households">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your households</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {households.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                setActiveHouseholdId(h.id)
                window.localStorage.setItem('shopnest_active_household', h.id)
              }}
              className={cn(
                'rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/50',
                h.id === effectiveId && 'border-primary ring-1 ring-primary/30'
              )}
            >
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold truncate">{h.name}</span>
                {h.plan === 'PLUS' && <Badge className="shrink-0">PLUS</Badge>}
                <Badge variant="outline" className="ml-auto shrink-0">{h.role.toLowerCase()}</Badge>
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create household
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setJoinOpen(true)}>
            <Users className="h-4 w-4" /> Join with code
          </Button>
        </div>
      </section>

      {household && (
        <>
          {/* Invite */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Invite family members</CardTitle>
              <CardDescription>
                Share this code — new members join {household.name} instantly. Codes can be rotated any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border bg-muted/50 px-4 py-3 text-lg font-bold tracking-[0.2em] text-center select-all">
                  {household.inviteCode}
                </code>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => copy(household.inviteCode, 'Invite code')} aria-label="Copy invite code">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => copy(`${window.location.origin}/?invite=${household.inviteCode}`, 'Invite link')} aria-label="Copy invite link" title="Copy invite link">
                  <Users className="h-4 w-4" />
                </Button>
                {isManager && (
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => regenerate.mutate(undefined)} aria-label="Regenerate invite code" title="Regenerate (revoke old code)">
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Invite links expire when the code is rotated or the household is deleted. Abuse protection: max 20 members.
              </p>
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Members ({household.members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {household.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <UserChip name={m.user.name} color={m.user.avatarColor} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {m.user.name}
                        {m.role === 'OWNER' && <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="owner" />}
                        {m.role === 'ADMIN' && <Shield className="h-3.5 w-3.5 text-primary" aria-label="admin" />}
                        {m.user.id === me?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email} · joined {timeAgo(m.joinedAt)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{m.role.toLowerCase()}</Badge>
                        {m.role === 'CAREGIVER' && <span className="text-xs text-muted-foreground shrink-0">shops for family</span>}
                    {isManager && m.role !== 'OWNER' && m.user.id !== me?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Manage ${m.user.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => changeRole.mutate({ memberId: m.id, role: m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN' })}>
                            <Shield className="mr-2 h-4 w-4" />
                            {m.role === 'ADMIN' ? 'Demote to member' : 'Promote to admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeRole.mutate({ memberId: m.id, role: m.role === 'CAREGIVER' ? 'MEMBER' : 'CAREGIVER' })}>
                            <HeartHandshake className="mr-2 h-4 w-4" />
                            {m.role === 'CAREGIVER' ? 'Remove caregiver access' : 'Set as caregiver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => removeMember.mutate({ memberId: m.id })}>
                            <UserMinus className="mr-2 h-4 w-4" /> Remove from household
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Plan */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Subscription
                <Badge variant={household.plan === 'PLUS' ? 'default' : 'secondary'}>
                  {household.plan === 'PLUS' ? 'ShopNest Plus' : 'Free plan'}
                </Badge>
              </CardTitle>
              <CardDescription>
                {household.plan === 'PLUS'
                  ? 'Your household has Plus. Thanks for supporting ShopNest!'
                  : 'Upgrade for advanced reminders, expanded photo & receipt storage, warranty tracking and premium templates.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {household.plan === 'PLUS' ? (
                <p className="text-sm text-muted-foreground">$3.99/month per household · manage billing in the app store.</p>
              ) : (
                <Button className="gap-1.5" onClick={() => setPlusOpen(true)}>
                  <Sparkles className="h-4 w-4" /> See ShopNest Plus
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notification preferences</CardTitle>
              <CardDescription>In-app notifications; native push arrives with the mobile build.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="nf-1" className="text-sm">Product confirmation requests</Label>
                  <p className="text-xs text-muted-foreground">When someone asks “is this the right product?”</p>
                </div>
                <Switch id="nf-1" checked={notifyList} onCheckedChange={(v) => { setNotifyList(v); updatePrefs.mutate({ notifyPrefs: { reminders: v } }) }} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="nf-2" className="text-sm">Purchases</Label>
                  <p className="text-xs text-muted-foreground">When items are marked purchased.</p>
                </div>
                <Switch id="nf-2" checked={notifyPurchases} onCheckedChange={(v) => { setNotifyPurchases(v); updatePrefs.mutate({ notifyPrefs: { purchases: v } }) }} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="nf-3" className="text-sm">Event reminders</Label>
                  <p className="text-xs text-muted-foreground">Upcoming household events.</p>
                </div>
                <Switch id="nf-3" checked={notifyEvents} onCheckedChange={(v) => { setNotifyEvents(v); updatePrefs.mutate({ notifyPrefs: { comments: v } }) }} />
                {/* V2: large-text accessibility (persisted) */}
                <div className="flex items-center justify-between gap-4 pt-1 border-t">
                  <div>
                    <Label htmlFor="nf-4" className="text-sm">Large text mode</Label>
                    <p className="text-xs text-muted-foreground">Bigger text everywhere — easier for grandparents and caregivers.</p>
                  </div>
                  <Switch
                    id="nf-4"
                    checked={largeText}
                    onCheckedChange={(v) => {
                      setLargeText(v)
                      updatePrefs.mutate({ largeText: v })
                      // reflect immediately for the current session
                      document.documentElement.style.fontSize = v ? '18px' : ''
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Household management */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isManager && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setRenameValue(household.name)
                    setRenameOpen(true)
                  }}
                >
                  Rename household
                </Button>
              )}
              {myRole !== 'OWNER' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setLeaveConfirm(household.id)}
                >
                  <LogOut className="h-4 w-4" /> Leave household
                </Button>
              )}
              {myRole === 'OWNER' && household.members.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Promote another member to owner before leaving. Household deletion is available after other members leave.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Account */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Signed in as {me?.name} ({me?.email}){me?.isAdmin ? ' · platform admin' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {me?.isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setTab('admin')}>
              Open admin portal
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setDeleteAccountOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
        </CardContent>
      </Card>

      {/* Create household */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a household</DialogTitle>
            <DialogDescription>You&apos;ll be the owner and can invite everyone else.</DialogDescription>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. The Johnson Family" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!newName.trim() || createHousehold.isPending}
              onClick={() =>
                createHousehold.mutate(
                  { name: newName.trim() },
                  {
                    onSuccess: () => {
                      setCreateOpen(false)
                      setNewName('')
                    },
                  }
                )
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join household */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a household</DialogTitle>
            <DialogDescription>Enter the invite code shared by your family member.</DialogDescription>
          </DialogHeader>
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="SN-XXXXXX"
            className="font-mono tracking-widest"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button
              disabled={!/^SN-[A-Z0-9]{6}$/.test(inviteCode) || joinHousehold.isPending}
              onClick={() =>
                joinHousehold.mutate(
                  { inviteCode },
                  {
                    onSuccess: () => {
                      setJoinOpen(false)
                      setInviteCode('')
                    },
                  }
                )
              }
            >
              Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename household</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              disabled={!renameValue.trim() || renameValue.trim() === household?.name}
              onClick={() =>
                renameHousehold.mutate(
                  { name: renameValue.trim() },
                  {
                    onSuccess: () => {
                      setRenameOpen(false)
                    },
                  }
                )
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave confirm */}
      <AlertDialog open={!!leaveConfirm} onOpenChange={(o) => !o && setLeaveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this household?</AlertDialogTitle>
            <AlertDialogDescription>You&apos;ll lose access to its lists, stores and events. You can re-join with an invite code.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (leaveConfirm)
                  leaveHousehold.mutate(
                    { householdId: leaveConfirm },
                    {
                      onSuccess: () => {
                        setLeaveConfirm(null)
                        window.location.reload()
                      },
                    }
                  )
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete account confirm */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account and removes you from all households. Shared items you added remain with
              the household. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                api('/api/auth/register', { method: 'DELETE', noOfflineQueue: true })
                  .then(() => {
                    window.location.reload()
                  })
                  .catch((err) => {
                    toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Deletion failed.' })
                  })
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlusDialog open={plusOpen} onOpenChange={setPlusOpen} householdId={effectiveId ?? ''} />
    </div>
  )
}
