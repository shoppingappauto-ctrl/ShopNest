'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { api, OfflineQueuedError } from '@/lib/shopnest/client'
import type {
  Activity,
  AdminStats,
  AdminUser,
  HouseholdDetail,
  HouseholdEvent,
  HouseholdProduct,
  ListDetail,
  Me,
  MyHousehold,
  ShoppingList,
  Store,
  HistoryItem,
} from '@/lib/shopnest/types'
import type { ShoppingSessionT } from '@/lib/shopnest/types'

export const qk = {
  me: ['me'] as const,
  household: (id: string) => ['household', id] as const,
  lists: (id: string) => ['lists', id] as const,
  list: (id: string) => ['list', id] as const,
  stores: (id: string) => ['stores', id] as const,
  products: (id: string) => ['products', id] as const,
  history: (id: string) => ['history', id] as const,
  activity: (id: string) => ['activity', id] as const,
  events: (id: string) => ['events', id] as const,
  outstanding: (id: string) => ['outstanding', id] as const,
  adminStats: ['admin-stats'] as const,
  adminUsers: (q: string) => ['admin-users', q] as const,
}

/**
 * after a successful mutation: invalidate caches on this device.
 * (Other devices are updated by the server-side broadcast in the API route.)
 */
function useSyncedMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  opts: {
    invalidate?: readonly (readonly string[])[]
    success?: string
  } = {}
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of opts.invalidate ?? []) queryClient.invalidateQueries({ queryKey: key })
      if (opts.success) toast({ description: opts.success })
    },
    onError: (error) => {
      if (error instanceof OfflineQueuedError) {
        toast({ description: error.message })
        return
      }
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      })
    },
  })
}

// ─── me ──────────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api<{ user: Me | null; households: MyHousehold[] }>('/api/auth/me'),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      api<{ user: Me }>('/api/auth/login', { method: 'POST', body: vars, noOfflineQueue: true }),
    onError: (error) =>
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Sign in failed.',
      }),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (vars: { name: string; email: string; password: string }) =>
      api<{ user: Me }>('/api/auth/register', { method: 'POST', body: vars, noOfflineQueue: true }),
    onError: (error) =>
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Registration failed.',
      }),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST', noOfflineQueue: true }),
  })
}

// ─── households ──────────────────────────────────────────────────────────────

export function useHousehold(id: string | undefined) {
  return useQuery({
    queryKey: qk.household(id ?? 'none'),
    queryFn: () => api<{ household: HouseholdDetail }>(`/api/households/${id}`),
    enabled: !!id,
  })
}

export function useCreateHousehold() {
  return useSyncedMutation(
    (vars: { name: string }) =>
      api<{ household: { id: string } }>('/api/households', { method: 'POST', body: vars }),
    { invalidate: [['me']], success: 'Household created' }
  )
}

export function useJoinHousehold() {
  return useSyncedMutation(
    (vars: { inviteCode: string }) =>
      api<{ household: { id: string; name: string } }>('/api/households/join', { method: 'POST', body: vars }),
    { invalidate: [['me']], success: 'Welcome! You joined the household' }
  )
}

export function useRenameHousehold(id: string) {
  return useSyncedMutation(
    (vars: { name: string }) => api(`/api/households/${id}`, { method: 'PATCH', body: vars }),
    {
      invalidate: [['household', id], ['me']],
      success: 'Household renamed',
    }
  )
}

export function useRegenerateInvite(id: string) {
  return useSyncedMutation(
    () => api<{ inviteCode: string }>(`/api/households/${id}/invite`, { method: 'POST' }),
    {
      invalidate: [['household', id], ['me']],
      success: 'New invite code generated — old links no longer work',
    }
  )
}

export function useUpdateMemberRole(id: string) {
  return useSyncedMutation(
    (vars: { memberId: string; role: 'ADMIN' | 'MEMBER' | 'CAREGIVER' }) =>
      api(`/api/households/${id}/members/${vars.memberId}`, { method: 'PATCH', body: { role: vars.role } }),
    {
      invalidate: [['household', id]],
      success: 'Member role updated',
    }
  )
}

export function useRemoveMember(id: string) {
  return useSyncedMutation(
    (vars: { memberId: string }) =>
      api(`/api/households/${id}/members/${vars.memberId}`, { method: 'DELETE' }),
    {
      invalidate: [['household', id]],
      success: 'Member removed',
    }
  )
}

export function useLeaveHousehold() {
  return useSyncedMutation(
    (vars: { householdId: string }) =>
      api(`/api/households/${vars.householdId}/leave`, { method: 'POST' }),
    { invalidate: [['me']], success: 'You left the household' }
  )
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api('/api/auth/account', { method: 'DELETE', noOfflineQueue: true }),
    onError: (error) =>
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Account deletion failed.',
      }),
  })
}

// ─── stores ──────────────────────────────────────────────────────────────────

export function useStores(householdId: string | undefined) {
  return useQuery({
    queryKey: qk.stores(householdId ?? 'none'),
    queryFn: () => api<{ stores: Store[] }>(`/api/households/${householdId}/stores`),
    enabled: !!householdId,
  })
}

export type OutstandingGroup = {
  storeId: string
  storeName: string
  category: string
  items: { id: string; name: string; quantity: number; unit: string; listName: string }[]
}

export function useOutstanding(householdId: string | undefined) {
  return useQuery({
    queryKey: ['outstanding', householdId ?? 'none'],
    queryFn: () => api<{ groups: OutstandingGroup[] }>(`/api/households/${householdId}/outstanding`),
    enabled: !!householdId,
  })
}

export function useCreateStore(householdId: string) {
  return useSyncedMutation(
    (vars: Partial<Store> & { name: string }) =>
      api<{ store: Store }>(`/api/households/${householdId}/stores`, { method: 'POST', body: vars }),
    {
      invalidate: [['stores', householdId]],
      success: 'Store added',
    }
  )
}

export function useUpdateStore(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string; patch: Partial<Store> }) =>
      api(`/api/stores/${vars.id}`, { method: 'PATCH', body: vars.patch }),
    {
      invalidate: [['stores', householdId]],
    }
  )
}

export function useDeleteStore(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string }) => api(`/api/stores/${vars.id}`, { method: 'DELETE' }),
    {
      invalidate: [['stores', householdId], ['lists', householdId]],
      success: 'Store removed',
    }
  )
}

// ─── lists & items ───────────────────────────────────────────────────────────

export function useLists(householdId: string | undefined) {
  return useQuery({
    queryKey: qk.lists(householdId ?? 'none'),
    queryFn: () => api<{ lists: ShoppingList[] }>(`/api/households/${householdId}/lists`),
    enabled: !!householdId,
  })
}

export function useList(listId: string | undefined) {
  return useQuery({
    queryKey: qk.list(listId ?? 'none'),
    queryFn: () => api<{ list: ListDetail }>(`/api/lists/${listId}`),
    enabled: !!listId,
  })
}

export function useCreateList(householdId: string) {
  return useSyncedMutation(
    (vars: { name: string; emoji?: string; storeId?: string | null }) =>
      api<{ list: ShoppingList }>(`/api/households/${householdId}/lists`, { method: 'POST', body: vars }),
    {
      invalidate: [['lists', householdId]],
      success: 'List created',
    }
  )
}

export function useUpdateList(householdId: string) {
  return useSyncedMutation(
    (vars: { listId: string; name?: string; emoji?: string; storeId?: string | null; status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' }) => {
      const { listId, ...body } = vars
      return api(`/api/lists/${listId}`, { method: 'PATCH', body })
    },
    {
      invalidate: [['list'], ['lists', householdId]],
    }
  )
}

export function useDeleteList(householdId: string) {
  return useSyncedMutation(
    (vars: { listId: string }) => api(`/api/lists/${vars.listId}`, { method: 'DELETE' }),
    {
      invalidate: [['lists', householdId]],
      success: 'List deleted',
    }
  )
}

export type AddItemVars = {
  listId: string
  name: string
  nameBn?: string | null
  quantity?: number
  unit?: string
  note?: string | null
  category?: string
  storeId?: string | null
  favoriteProductId?: string | null
  isRecurring?: boolean
}

export function useAddItem(householdId: string) {
  return useSyncedMutation(({ listId, ...body }: AddItemVars) =>
    api<{ item: unknown }>(`/api/lists/${listId}/items`, { method: 'POST', body }),
    {
      invalidate: [['list'], ['lists', householdId], ['history', householdId], ['products', householdId], ['activity', householdId]],
    }
  )
}

export function useUpdateItem(householdId: string) {
  return useSyncedMutation(
    (vars: { itemId: string; patch: Record<string, unknown> }) =>
      api(`/api/items/${vars.itemId}`, { method: 'PATCH', body: vars.patch }),
    {
      invalidate: [['list'], ['lists', householdId], ['history', householdId], ['products', householdId], ['activity', householdId]],
    }
  )
}

export function useDeleteItem(householdId: string) {
  return useSyncedMutation(
    (vars: { itemId: string }) => api(`/api/items/${vars.itemId}`, { method: 'DELETE' }),
    {
      invalidate: [['list'], ['lists', householdId]],
      success: 'Item removed',
    }
  )
}

export function useAddComment(householdId: string) {
  return useSyncedMutation(
    (vars: { itemId: string; kind: string; text: string }) =>
      api(`/api/items/${vars.itemId}/comments`, { method: 'POST', body: { kind: vars.kind, text: vars.text } }),
    {
      invalidate: [['list'], ['activity', householdId]],
    }
  )
}

export function useAddPhoto(householdId: string) {
  return useSyncedMutation(
    (vars: { itemId: string; dataUrl: string }) =>
      api(`/api/items/${vars.itemId}/photos`, { method: 'POST', body: { dataUrl: vars.dataUrl } }),
    {
      invalidate: [['list'], ['activity', householdId]],
      success: 'Photo attached',
    }
  )
}

export function useDeletePhoto(householdId: string) {
  return useSyncedMutation(
    (vars: { itemId: string; photoId: string }) =>
      api(`/api/items/${vars.itemId}/photos?photoId=${vars.photoId}`, { method: 'DELETE' }),
    {
      invalidate: [['list']],
    }
  )
}

// ─── products (favorites / recurring) ────────────────────────────────────────

export function useProducts(householdId: string | undefined) {
  return useQuery({
    queryKey: qk.products(householdId ?? 'none'),
    queryFn: () => api<{ products: HouseholdProduct[] }>(`/api/households/${householdId}/products`),
    enabled: !!householdId,
  })
}

export function useCreateProduct(householdId: string) {
  return useSyncedMutation(
    (vars: Partial<HouseholdProduct> & { name: string }) =>
      api<{ product: HouseholdProduct }>(`/api/households/${householdId}/products`, { method: 'POST', body: vars }),
    {
      invalidate: [['products', householdId]],
      success: 'Saved to household catalog',
    }
  )
}

export function useUpdateProduct(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string; patch: Partial<HouseholdProduct> }) =>
      api(`/api/products/${vars.id}`, { method: 'PATCH', body: vars.patch }),
    {
      invalidate: [['products', householdId]],
    }
  )
}

export function useDeleteProduct(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string }) => api(`/api/products/${vars.id}`, { method: 'DELETE' }),
    {
      invalidate: [['products', householdId]],
      success: 'Removed from catalog',
    }
  )
}

// ─── history & activity ──────────────────────────────────────────────────────

export function useHistory(householdId: string | undefined) {
  return useQuery({
    queryKey: qk.history(householdId ?? 'none'),
    queryFn: () => api<{ items: HistoryItem[] }>(`/api/households/${householdId}/history`),
    enabled: !!householdId,
  })
}

export function useActivity(householdId: string | undefined) {
  return useQuery({
    queryKey: qk.activity(householdId ?? 'none'),
    queryFn: () => api<{ activities: Activity[] }>(`/api/households/${householdId}/activity`),
    enabled: !!householdId,
    refetchInterval: 45_000,
  })
}

// ─── events ──────────────────────────────────────────────────────────────────

export function useEvents(householdId: string | undefined) {
  return useQuery({
    queryKey: qk.events(householdId ?? 'none'),
    queryFn: () => api<{ events: HouseholdEvent[] }>(`/api/households/${householdId}/events`),
    enabled: !!householdId,
  })
}

export function useCreateEvent(householdId: string) {
  return useSyncedMutation(
    (vars: { name: string; type?: string; date?: string | null; guestCount?: number | null; budget?: number | null; notes?: string | null }) =>
      api(`/api/households/${householdId}/events`, { method: 'POST', body: vars }),
    {
      invalidate: [['events', householdId], ['activity', householdId]],
      success: 'Event created',
    }
  )
}

export function useUpdateEvent(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string; patch: Record<string, unknown> }) =>
      api(`/api/events/${vars.id}`, { method: 'PATCH', body: vars.patch }),
    {
      invalidate: [['events', householdId]],
    }
  )
}

export function useDeleteEvent(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string }) => api(`/api/events/${vars.id}`, { method: 'DELETE' }),
    {
      invalidate: [['events', householdId]],
      success: 'Event deleted',
    }
  )
}

export function useAddEventItem(householdId: string) {
  return useSyncedMutation(
    (vars: { eventId: string; name: string; quantity?: number; unit?: string; category?: string }) =>
      api(`/api/events/${vars.eventId}/items`, {
        method: 'POST',
        body: { name: vars.name, quantity: vars.quantity, unit: vars.unit, category: vars.category },
      }),
    {
      invalidate: [['events', householdId]],
    }
  )
}

export function useUpdateEventItem(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string; patch: Record<string, unknown> }) =>
      api(`/api/event-items/${vars.id}`, { method: 'PATCH', body: vars.patch }),
    {
      invalidate: [['events', householdId]],
    }
  )
}

export function useDeleteEventItem(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string }) => api(`/api/event-items/${vars.id}`, { method: 'DELETE' }),
    {
      invalidate: [['events', householdId]],
    }
  )
}

// ─── admin ───────────────────────────────────────────────────────────────────

export function useAdminStats(enabled: boolean) {
  return useQuery({
    queryKey: qk.adminStats,
    queryFn: () => api<AdminStats>('/api/admin/stats'),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useAdminUsers(q: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.adminUsers(q),
    queryFn: () => api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`),
    enabled,
  })
}

export function useAdminPatchUser() {
  return useSyncedMutation(
    (vars: { id: string; patch: { isSuspended?: boolean; isAdmin?: boolean } }) =>
      api(`/api/admin/users/${vars.id}`, { method: 'PATCH', body: vars.patch }),
    { invalidate: [['admin-users'], ['admin-stats']], success: 'User updated' }
  )
}

// ═══ V2: shopping sessions (Shopping Mode) ═══════════════════════════════════

export function useStartShoppingSession(householdId: string) {
  return useSyncedMutation(
    (vars: { listId?: string | null; storeId?: string | null }) =>
      api<{ session: { id: string } }>(`/api/households/${householdId}/shopping-sessions`, {
        method: 'POST',
        body: vars,
        noOfflineQueue: true,
      }),
    { invalidate: [qk.outstanding(householdId)] }
  )
}

export function useFinishShoppingSession(householdId: string) {
  return useSyncedMutation(
    (sessionId: string) =>
      api<{ session: ShoppingSessionT; summary: unknown }>(`/api/shopping-sessions/${sessionId}`, {
        method: 'PATCH',
        noOfflineQueue: true,
      }),
    { invalidate: [['sessions', householdId], ['history'], qk.lists(householdId), qk.me] }
  )
}

export function useShoppingSessions(householdId: string | undefined) {
  return useQuery({
    queryKey: ['sessions', householdId ?? 'none'],
    queryFn: () => api<{ sessions: ShoppingSessionT[] }>(`/api/households/${householdId}/shopping-sessions`),
    enabled: !!householdId,
  })
}

// ═══ V2: photo confirmations (Ask Family) ═══════════════════════════════════

export type ConfirmationRequestT = {
  id: string
  itemId: string
  householdId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUBSTITUTE_SUGGESTED' | 'CANCELLED'
  note: string | null
  decisionNote: string | null
  substituteName: string | null
  version: number
  createdAt: string
  decidedAt: string | null
  photo: { id: string; dataUrl: string } | null
  requestedBy: { id: string; name: string; avatarColor: string } | null
  decidedBy: { id: string; name: string; avatarColor: string } | null
  item?: { id: string; name: string; listId?: string }
}

export function useConfirmations(householdId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['confirmations', householdId ?? 'none', status ?? 'all'],
    queryFn: () =>
      api<{ requests: ConfirmationRequestT[] }>(
        `/api/households/${householdId}/confirmations${status ? `?status=${status}` : ''}`
      ),
    enabled: !!householdId,
  })
}

export function useItemConfirmations(itemId: string | undefined) {
  return useQuery({
    queryKey: ['confirmations', 'item', itemId ?? 'none'],
    queryFn: () => api<{ requests: ConfirmationRequestT[] }>(`/api/items/${itemId}/confirmations`),
    enabled: !!itemId,
  })
}

export function useAskFamily(itemId: string) {
  return useSyncedMutation(
    (vars: { note?: string | null; photoDataUrl?: string | null }) =>
      api<{ request: ConfirmationRequestT }>(`/api/items/${itemId}/confirmations`, {
        method: 'POST',
        body: vars,
        noOfflineQueue: true,
      }),
    { invalidate: [['confirmations'], ['lists'], ['list']] }
  )
}

export function useDecideConfirmation(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string; action: 'decide' | 'cancel'; decision?: 'APPROVED' | 'REJECTED' | 'SUBSTITUTE_SUGGESTED'; note?: string | null; substituteName?: string | null; version: number }) =>
      api<{ request: ConfirmationRequestT }>(`/api/confirmations/${vars.id}`, {
        method: 'PATCH',
        body: vars,
        noOfflineQueue: true,
      }),
    { invalidate: [['confirmations'], ['lists'], ['list'], qk.activity(householdId)] }
  )
}

// ═══ V2: budgets ═════════════════════════════════════════════════════════════

export type BudgetT = {
  id: string
  scope: 'TRIP' | 'WEEKLY' | 'MONTHLY' | 'EVENT'
  listId: string | null
  eventId: string | null
  amountCents: number
  currency: string
  periodStart: string | null
  spendCents: number
  list?: { id: string; name: string; emoji: string } | null
  event?: { id: string; name: string } | null
}

export function useBudgets(householdId: string | undefined) {
  return useQuery({
    queryKey: ['budgets', householdId ?? 'none'],
    queryFn: () => api<{ budgets: BudgetT[] }>(`/api/households/${householdId}/budgets`),
    enabled: !!householdId,
  })
}

export function useSetBudget(householdId: string) {
  return useSyncedMutation(
    (vars: { scope: 'TRIP' | 'WEEKLY' | 'MONTHLY' | 'EVENT'; listId?: string | null; eventId?: string | null; amountCents: number; periodStart?: string | null }) =>
      api<{ budget: BudgetT }>(`/api/households/${householdId}/budgets`, { method: 'POST', body: vars }),
    { invalidate: [['budgets']], success: 'Budget saved' }
  )
}

export function useDeleteBudget(householdId: string) {
  return useSyncedMutation(
    (budgetId: string) => api(`/api/households/${householdId}/budgets/${budgetId}`, { method: 'DELETE' }),
    { invalidate: [['budgets']] }
  )
}

// ═══ V2: price memory ════════════════════════════════════════════════════════

export type PriceObservationT = {
  id: string
  itemName: string
  nameBn: string | null
  productId: string | null
  storeId: string | null
  storeName: string | null
  quantity: number
  unit: string
  packageSize: string | null
  totalPriceCents: number
  currency: string
  unitPriceCents: number | null
  unitPriceBasis: string | null
  source: string
  observedAt: string
  notes: string | null
  store?: { id: string; name: string } | null
  observedBy?: { id: string; name: string; avatarColor: string } | null
}

export function usePriceObservations(householdId: string | undefined, itemName?: string, productId?: string) {
  return useQuery({
    queryKey: ['prices', householdId ?? 'none', itemName ?? 'all', productId ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams()
      if (itemName) params.set('itemName', itemName)
      if (productId) params.set('productId', productId)
      return api<{ observations: PriceObservationT[]; byProduct: unknown[] }>(
        `/api/households/${householdId}/price-observations${params.size ? `?${params}` : ''}`
      )
    },
    enabled: !!householdId,
  })
}

export function useAddPriceObservation(householdId: string) {
  return useSyncedMutation(
    (vars: { itemName: string; nameBn?: string | null; productId?: string | null; storeId?: string | null; quantity: number; unit: string; packageSize?: string | null; totalPriceCents: number; source?: string; notes?: string | null }) =>
      api<{ observation: PriceObservationT }>(`/api/households/${householdId}/price-observations`, {
        method: 'POST',
        body: vars,
      }),
    { invalidate: [['prices']], success: 'Price saved to Price Memory' }
  )
}

export function useDeletePriceObservation(householdId: string) {
  return useSyncedMutation(
    (obsId: string) => api(`/api/households/${householdId}/price-observations/${obsId}`, { method: 'DELETE' }),
    { invalidate: [['prices']] }
  )
}

export function usePriceCompare(householdId: string | undefined, listId: string | undefined) {
  return useQuery({
    queryKey: ['price-compare', householdId ?? 'none', listId ?? 'none'],
    queryFn: () =>
      api<{ stores: { storeId: string; storeName: string; estimatedTotalCents: number; matched: number; missingCount: number; missing: string[]; staleUsed: string[] }[]; note: string }>(
        `/api/households/${householdId}/price-compare?listId=${listId}`
      ),
    enabled: !!householdId && !!listId,
  })
}

// ═══ V2: pantry ══════════════════════════════════════════════════════════════

export type PantryItemT = {
  id: string
  name: string
  nameBn: string | null
  category: string
  quantity: number | null
  unit: string | null
  status: 'IN_STOCK' | 'RUNNING_LOW' | 'OUT_OF_STOCK' | 'UNKNOWN'
  householdProductId: string | null
  notes: string | null
  lastUpdatedAt: string
  householdProduct?: { id: string; name: string } | null
}

export function usePantry(householdId: string | undefined) {
  return useQuery({
    queryKey: ['pantry', householdId ?? 'none'],
    queryFn: () => api<{ items: PantryItemT[] }>(`/api/households/${householdId}/pantry`),
    enabled: !!householdId,
  })
}

export function useAddPantryItem(householdId: string) {
  return useSyncedMutation(
    (vars: { name: string; nameBn?: string | null; category?: string; quantity?: number | null; unit?: string | null; status?: string; householdProductId?: string | null; notes?: string | null }) =>
      api<{ item: PantryItemT }>(`/api/households/${householdId}/pantry`, { method: 'POST', body: vars }),
    { invalidate: [['pantry'], qk.activity(householdId)], success: 'Added to pantry' }
  )
}

export function useUpdatePantryItem(householdId: string) {
  return useSyncedMutation(
    (vars: { id: string; quantity?: number | null; unit?: string | null; status?: string; notes?: string | null }) =>
      api<{ item: PantryItemT }>(`/api/households/${householdId}/pantry/${vars.id}`, {
        method: 'PATCH',
        body: vars,
      }),
    { invalidate: [['pantry']] }
  )
}

export function useDeletePantryItem(householdId: string) {
  return useSyncedMutation(
    (id: string) => api(`/api/households/${householdId}/pantry/${id}`, { method: 'DELETE' }),
    { invalidate: [['pantry']] }
  )
}

// ═══ V2: catalog search ══════════════════════════════════════════════════════

export type CatalogEntry = {
  name: string
  nameBn?: string
  aliases?: string[]
  category: string
  defaultQty: number
  unit: string
  preferredStoreCategory?: string
  dietary?: string[]
}

export function useCatalogSearch(q: string, householdId?: string) {
  return useQuery({
    queryKey: ['catalog', q, householdId ?? 'none'],
    queryFn: () =>
      api<{ catalog: CatalogEntry[]; household: { id: string; name: string; nameBn: string | null; category: string; defaultQty: number; unit: string; aliases: string[] }[] }>(
        `/api/catalog?q=${encodeURIComponent(q)}${householdId ? `&householdId=${householdId}` : ''}`
      ),
    staleTime: 60_000,
  })
}

// ═══ V2: events (templates, assignments, copy-to-list) ═══════════════════════

export function useDuplicateEvent(householdId: string) {
  return useSyncedMutation(
    (vars: { eventId: string; name?: string; asTemplate?: boolean }) =>
      api<{ event: { id: string } }>(`/api/events/${vars.eventId}/duplicate`, {
        method: 'POST',
        body: { name: vars.name, asTemplate: vars.asTemplate ?? false },
      }),
    { invalidate: [qk.events(householdId)], success: 'Event duplicated' }
  )
}

export function useCopyEventToList(householdId: string) {
  return useSyncedMutation(
    (vars: { eventId: string; listId: string }) =>
      api<{ copied: number; skipped: number }>(`/api/events/${vars.eventId}/copy-to-list`, {
        method: 'POST',
        body: { listId: vars.listId },
      }),
    { invalidate: [qk.lists(householdId), qk.events(householdId)] }
  )
}

// ═══ V2: user preferences ════════════════════════════════════════════════════

export function useUpdatePrefs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { notifyPrefs?: { purchases?: boolean; comments?: boolean; reminders?: boolean }; largeText?: boolean; name?: string }) =>
      api('/api/auth/prefs', { method: 'PATCH', body: vars, noOfflineQueue: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  })
}
