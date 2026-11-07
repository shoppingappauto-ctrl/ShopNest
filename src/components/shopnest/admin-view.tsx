'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Home,
  ListChecks,
  ShoppingCart,
  Activity,
  Database,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import { useAdminStats, useAdminUsers, useAdminPatchUser } from '@/lib/shopnest/hooks'
import { timeAgo } from '@/components/shopnest/ui-bits'

function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function AdminView() {
  const statsQ = useAdminStats(true)
  const [q, setQ] = useState('')
  const usersQ = useAdminUsers(q, true)
  const patchUser = useAdminPatchUser()

  const stats = statsQ.data

  const cards = [
    { label: 'Total users', value: stats?.users.total, icon: Users, sub: `${stats?.users.newThisWeek ?? 0} new this week` },
    { label: 'Households', value: stats?.households.total, icon: Home, sub: `${stats?.households.plus ?? 0} Plus · ${stats?.households.free ?? 0} free` },
    { label: 'DAU / WAU / MAU', value: stats ? `${stats.engagement.dau} / ${stats.engagement.wau} / ${stats.engagement.mau}` : undefined, icon: Activity, sub: 'last-active based' },
    { label: 'Shopping lists', value: stats?.shopping.lists, icon: ListChecks, sub: `${stats?.shopping.items ?? 0} items · ${stats?.shopping.purchasedItems ?? 0} purchased` },
    {
      label: 'MRR',
      value: stats ? `$${stats.billing.mrr.toFixed(2)}` : undefined,
      icon: ShoppingCart,
      sub: stats?.billing.paymentsEnabled ? `${stats.billing.payingHouseholds} paying households` : 'payments disabled — plan flags only',
    },
    { label: 'Photo storage', value: stats ? bytes(stats.storage.bytes) : undefined, icon: Database, sub: `${stats?.storage.photos ?? 0} photos` },
  ]

  return (
    <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Admin portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Real platform metrics · private household data is never exposed here.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => statsQ.refetch()} disabled={statsQ.isFetching}>
          <RefreshCw className={`h-4 w-4 ${statsQ.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="py-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <c.icon className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">{c.label}</p>
              </div>
              {statsQ.isLoading ? (
                <Skeleton className="h-7 w-20 mt-1.5" />
              ) : (
                <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">{c.value ?? '—'}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!stats?.billing.paymentsEnabled && (
        <Card className="border-amber-500/40 bg-amber-500/5 py-0">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
            {stats?.billing.note ?? 'Payments are disabled in this build; MRR reflects plan flags only.'}
          </CardContent>
        </Card>
      )}

      {/* V2 feature metrics (real data only) */}
      {stats?.v2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">V2 feature usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { label: 'Shopping sessions started', value: stats.v2.shoppingSessionsStarted },
                { label: 'Sessions completed', value: stats.v2.shoppingSessionsCompleted },
                { label: 'Photo confirmations', value: stats.v2.confirmationRequests },
                { label: 'Confirmations decided', value: stats.v2.confirmationsDecided },
                { label: 'Pending confirmations', value: stats.v2.pendingConfirmations },
                { label: 'Avg response (min)', value: stats.v2.avgConfirmationMinutes ?? '—' },
                { label: 'Budgets set', value: stats.v2.budgets },
                { label: 'Price observations', value: stats.v2.priceObservations },
                { label: 'Pantry items', value: stats.v2.pantryItems },
                { label: 'Events', value: stats.v2.events },
                { label: 'Event templates', value: stats.v2.eventTemplates },
                { label: 'Caregiver members', value: stats.v2.caregiverMembers },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border bg-card p-3">
                  <p className="text-lg font-bold tabular-nums">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{stats.v2.note}</p>
          </CardContent>
        </Card>
      )}

      {/* User management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">User management</CardTitle>
          <div className="pt-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto scrollbar-slim">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Households</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Suspend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ) : (usersQ.data?.users ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No accounts match “{q}”.
                  </TableCell>
                </TableRow>
              ) : (
                (usersQ.data?.users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.name}{u.isAdmin && <Badge variant="outline" className="ml-2 text-[10px]">admin</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell className="text-xs">{timeAgo(u.createdAt)}</TableCell>
                    <TableCell className="text-xs">{timeAgo(u.lastActiveAt)}</TableCell>
                    <TableCell className="tabular-nums">{u._count.memberships}</TableCell>
                    <TableCell>
                      {u.isSuspended ? (
                        <Badge variant="destructive">suspended</Badge>
                      ) : (
                        <Badge variant="secondary">active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={!u.isSuspended}
                        onCheckedChange={(v) => patchUser.mutate({ id: u.id, patch: { isSuspended: !v } })}
                        aria-label={u.isSuspended ? `Unsuspend ${u.name}` : `Suspend ${u.name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
