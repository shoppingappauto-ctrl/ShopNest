/**
 * ShopNest Mobile — react-query hooks.
 *
 * Mirrors the web app's `src/lib/shopnest/hooks.ts` query keys + mutations,
 * but typed against `@shopnest/shared` API response shapes and using the
 * native api-client (Bearer token from secure store + offline queue).
 *
 * Hooks are organized by resource so each screen can import exactly what it
 * needs. Mutations invalidate the same cache keys the realtime layer targets
 * (see lib/realtime.ts EVENT_TO_KEYS) so other devices + this device converge.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  formatCents,
  STORE_CATEGORY_EMOJI,
  STORE_CATEGORY_LABEL,
} from '@shopnest/shared'
import type {
  Activity,
  Budget,
  CatalogSearchQuery,
  CatalogSearchResponse,
  ConfirmationRequest,
  CreateBudgetRequest,
  CreateEventItemRequest,
  CreateEventRequest,
  CreateHouseholdRequest,
  CreateItemRequest,
  CreateListRequest,
  CreatePantryItemRequest,
  CreatePriceObservationRequest,
  CreateStoreRequest,
  DecideConfirmationRequest,
  HouseholdDetail,
  HouseholdEvent,
  HouseholdProduct,
  HouseholdProduct as Product,
  ListDetail,
  ListHouseholdsResponse,
  Me,
  MeResponse,
  MyHousehold,
  OutstandingGroup,
  OutstandingResponse,
  PantryItem,
  PriceCompareResponse,
  PriceObservation,
  ShoppingItem,
  ShoppingList,
  ShoppingSessionT,
  Store,
} from '@shopnest/shared'
import type {
  CreateBudgetResponse,
  CreateEventItemResponse,
  CreateEventResponse,
  CreateHouseholdResponse,
  CreateItemResponse,
  CreateListResponse,
  CreatePantryItemResponse,
  CreatePriceObservationResponse,
  CreateStoreResponse,
  CreateProductRequest,
  CreateProductResponse,
  CreateHouseholdConfirmationRequest,
  CreateItemConfirmationRequest,
  CreateItemConfirmationResponse,
  CreateHouseholdConfirmationResponse,
  DecideConfirmationResponse,
  FinishSessionResponse,
  GetHouseholdResponse,
  GetListResponse,
  GetSessionResponse,
  JoinHouseholdRequest,
  JoinHouseholdResponse,
  ListActivityResponse,
  ListBudgetsResponse,
  CatalogSearchResponse as _CatalogSearchResponse,
  ListEventsResponse,
  ListHouseholdConfirmationsResponse,
  ListHistoryResponse,
  ListListsResponse,
  ListPantryResponse,
  ListPriceObservationsResponse,
  ListProductsResponse,
  ListSessionsResponse,
  ListStoresResponse,
  ListItemConfirmationsResponse,
  LoginRequest,
  LoginResponse,
  OutstandingResponse as _OutstandingResponse,
  PatchBudgetRequest,
  PatchEventItemRequest,
  PatchEventRequest,
  PatchItemRequest,
  PatchListRequest,
  PatchPantryItemRequest,
  PatchStoreRequest,
  PatchProductRequest,
  PriceCompareResponse as _PriceCompareResponse,
  RegisterRequest,
  RegisterResponse,
  RotateInviteResponse,
  StartSessionRequest,
  StartSessionResponse,
  UpdatePrefsRequest,
  UpdatePrefsResponse,
} from '@shopnest/shared'
import { api } from './api-client'

// Re-export shared helpers so screens can import everything from one place.
export { CATEGORY_EMOJI, CATEGORY_LABEL, STORE_CATEGORY_EMOJI, STORE_CATEGORY_LABEL, formatCents }

// ─── Query keys (mirrors web qk) ──────────────────────────────────────────────

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
  event: (id: string) => ['event', id] as const,
  outstanding: (id: string) => ['outstanding', id] as const,
  pantry: (id: string) => ['pantry', id] as const,
  budgets: (id: string) => ['budgets', id] as const,
  prices: (id: string) => ['prices', id] as const,
  sessions: (id: string) => ['sessions', id] as const,
  session: (id: string) => ['session', id] as const,
  confirmations: (id: string) => ['confirmations', id] as const,
  catalog: (q: string) => ['catalog', q] as const,
  priceCompare: (hhId: string, listId: string) => ['price-compare', hhId, listId] as const,
} as const

// ─── Me / households ──────────────────────────────────────────────────────────

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: qk.me,
    queryFn: () => api<MeResponse>('/api/auth/me'),
    staleTime: 30_000,
  })
}

export function useUpdatePrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: UpdatePrefsRequest) =>
      api<UpdatePrefsResponse>('/api/auth/prefs', { method: 'PATCH', body: req }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useCreateHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateHouseholdRequest) =>
      api<CreateHouseholdResponse>('/api/households', { method: 'POST', body: req, label: 'Create household' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

export function useJoinHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: JoinHouseholdRequest) =>
      api<JoinHouseholdResponse>('/api/households/join', { method: 'POST', body: req, label: 'Join household' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

export function useHouseholds() {
  return useQuery<ListHouseholdsResponse>({
    queryKey: ['households'],
    queryFn: () => api<ListHouseholdsResponse>('/api/households'),
  })
}

export function useHousehold(id: string | null) {
  return useQuery<GetHouseholdResponse>({
    queryKey: id ? qk.household(id) : ['household', 'none'],
    queryFn: () => api<GetHouseholdResponse>(`/api/households/${id}`),
    enabled: !!id,
  })
}

export function useLeaveHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/api/households/${id}/leave`, { method: 'POST', label: 'Leave household' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

export function useRotateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<RotateInviteResponse>(`/api/households/${id}/invite`, { method: 'POST' }),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: qk.household(id) }),
  })
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export function useLists(householdId: string | null) {
  return useQuery<ListListsResponse>({
    queryKey: householdId ? qk.lists(householdId) : ['lists', 'none'],
    queryFn: () => api<ListListsResponse>(`/api/households/${householdId}/lists`),
    enabled: !!householdId,
  })
}

export function useList(id: string | null) {
  return useQuery<GetListResponse>({
    queryKey: id ? qk.list(id) : ['list', 'none'],
    queryFn: () => api<GetListResponse>(`/api/lists/${id}`),
    enabled: !!id,
  })
}

export function useCreateList(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateListRequest) =>
      api<CreateListResponse>(`/api/households/${householdId}/lists`, { method: 'POST', body: req, label: 'Create list' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.lists(householdId) }),
  })
}

export function usePatchList(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchListRequest }) =>
      api<{ list: ShoppingList }>(`/api/lists/${id}`, { method: 'PATCH', body: patch, label: 'Update list' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.lists(householdId) })
      qc.invalidateQueries({ queryKey: ['list'] })
    },
  })
}

export function useDeleteList(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/lists/${id}`, { method: 'DELETE', label: 'Delete list' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.lists(householdId) }),
  })
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, req, householdId }: { listId: string; req: CreateItemRequest; householdId: string }) =>
      api<CreateItemResponse>(`/api/lists/${listId}/items`, { method: 'POST', body: req, label: 'Add item' }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.list(vars.listId) })
      qc.invalidateQueries({ queryKey: qk.lists(vars.householdId) })
      qc.invalidateQueries({ queryKey: qk.stores(vars.householdId) })
      qc.invalidateQueries({ queryKey: qk.outstanding(vars.householdId) })
      qc.invalidateQueries({ queryKey: qk.activity(vars.householdId) })
    },
  })
}

export function usePatchItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchItemRequest }) =>
      api<{ item: ShoppingItem }>(`/api/items/${id}`, { method: 'PATCH', body: patch, label: 'Update item' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list'] })
      qc.invalidateQueries({ queryKey: qk.lists(householdId) })
      qc.invalidateQueries({ queryKey: qk.outstanding(householdId) })
      qc.invalidateQueries({ queryKey: qk.activity(householdId) })
      qc.invalidateQueries({ queryKey: qk.history(householdId) })
      qc.invalidateQueries({ queryKey: qk.sessions(householdId) })
    },
  })
}

export function useDeleteItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/items/${id}`, { method: 'DELETE', label: 'Remove item' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list'] })
      qc.invalidateQueries({ queryKey: qk.lists(householdId) })
      qc.invalidateQueries({ queryKey: qk.outstanding(householdId) })
    },
  })
}

export function useAddItemPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, dataUrl }: { itemId: string; dataUrl: string }) =>
      api<{ photo: { id: string } }>(`/api/items/${itemId}/photos`, {
        method: 'POST',
        body: { dataUrl } as { dataUrl: string },
        label: 'Upload photo',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list'] }),
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      itemId,
      kind,
      text,
    }: {
      itemId: string
      kind?: 'COMMENT' | 'APPROVE' | 'REJECT' | 'SUBSTITUTE'
      text: string
    }) =>
      api<{ comment: { id: string } }>(`/api/items/${itemId}/comments`, {
        method: 'POST',
        body: { kind: kind ?? 'COMMENT', text },
        label: 'Add comment',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list'] }),
  })
}

// ─── Confirmations ────────────────────────────────────────────────────────────

export function useHouseholdConfirmations(householdId: string | null, status?: string) {
  return useQuery<ListHouseholdConfirmationsResponse>({
    queryKey: householdId
      ? [...qk.confirmations(householdId), status ?? 'all']
      : ['confirmations', 'none'],
    queryFn: () =>
      api<ListHouseholdConfirmationsResponse>(
        `/api/households/${householdId}/confirmations${status ? `?status=${status}` : ''}`,
      ),
    enabled: !!householdId,
    // Poll pending confirmations so a stuck device still converges when the
    // socket is unavailable (e.g. backgrounded, on cellular).
    refetchInterval: 15_000,
  })
}

export function useItemConfirmations(itemId: string | null) {
  return useQuery<ListItemConfirmationsResponse>({
    queryKey: itemId ? ['item-confirmations', itemId] : ['item-confirmations', 'none'],
    queryFn: () => api<ListItemConfirmationsResponse>(`/api/items/${itemId}/confirmations`),
    enabled: !!itemId,
  })
}

export function useCreateItemConfirmation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, req }: { itemId: string; req: CreateItemConfirmationRequest }) =>
      api<CreateItemConfirmationResponse>(`/api/items/${itemId}/confirmations`, {
        method: 'POST',
        body: req,
        label: 'Ask family',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list'] })
      qc.invalidateQueries({ queryKey: ['confirmations'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useCreateHouseholdConfirmation(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ req }: { req: CreateHouseholdConfirmationRequest }) =>
      api<CreateHouseholdConfirmationResponse>(`/api/households/${householdId}/confirmations`, {
        method: 'POST',
        body: req,
        label: 'Ask family',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.confirmations(householdId) }),
  })
}

export function useDecideConfirmation(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: DecideConfirmationRequest }) =>
      api<DecideConfirmationResponse>(`/api/confirmations/${id}`, { method: 'PATCH', body: req, label: 'Decide' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.confirmations(householdId) })
      qc.invalidateQueries({ queryKey: ['list'] })
      qc.invalidateQueries({ queryKey: qk.activity(householdId) })
    },
  })
}

// ─── Stores ───────────────────────────────────────────────────────────────────

export function useStores(householdId: string | null) {
  return useQuery<ListStoresResponse>({
    queryKey: householdId ? qk.stores(householdId) : ['stores', 'none'],
    queryFn: () => api<ListStoresResponse>(`/api/households/${householdId}/stores`),
    enabled: !!householdId,
  })
}

export function useCreateStore(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateStoreRequest) =>
      api<CreateStoreResponse>(`/api/households/${householdId}/stores`, { method: 'POST', body: req, label: 'Add store' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.stores(householdId) })
      qc.invalidateQueries({ queryKey: qk.activity(householdId) })
    },
  })
}

export function usePatchStore(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchStoreRequest }) =>
      api<{ store: Store }>(`/api/stores/${id}`, { method: 'PATCH', body: patch, label: 'Update store' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.stores(householdId) }),
  })
}

export function useDeleteStore(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/stores/${id}`, { method: 'DELETE', label: 'Remove store' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.stores(householdId) }),
  })
}

// ─── Outstanding (grouped by store) ───────────────────────────────────────────

export function useOutstanding(householdId: string | null) {
  return useQuery<{ groups: OutstandingGroup[] }>({
    queryKey: householdId ? qk.outstanding(householdId) : ['outstanding', 'none'],
    queryFn: () => api<OutstandingResponse>(`/api/households/${householdId}/outstanding`),
    enabled: !!householdId,
  })
}

// ─── Shopping sessions ─────────────────────────────────────────────────────────

export function useSessions(householdId: string | null) {
  return useQuery<ListSessionsResponse>({
    queryKey: householdId ? qk.sessions(householdId) : ['sessions', 'none'],
    queryFn: () => api<ListSessionsResponse>(`/api/households/${householdId}/shopping-sessions`),
    enabled: !!householdId,
  })
}

export function useSession(id: string | null) {
  return useQuery<GetSessionResponse>({
    queryKey: id ? qk.session(id) : ['session', 'none'],
    queryFn: () => api<GetSessionResponse>(`/api/shopping-sessions/${id}`),
    enabled: !!id,
  })
}

export function useStartSession(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: StartSessionRequest) =>
      api<StartSessionResponse>(`/api/households/${householdId}/shopping-sessions`, { method: 'POST', body: req, label: 'Start shopping' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions(householdId) }),
  })
}

export function useFinishSession(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<FinishSessionResponse>(`/api/shopping-sessions/${id}`, { method: 'PATCH', label: 'Finish shopping' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sessions(householdId) })
      qc.invalidateQueries({ queryKey: ['list'] })
      qc.invalidateQueries({ queryKey: qk.lists(householdId) })
      qc.invalidateQueries({ queryKey: qk.history(householdId) })
    },
  })
}

// ─── Pantry ───────────────────────────────────────────────────────────────────

export function usePantry(householdId: string | null) {
  return useQuery<ListPantryResponse>({
    queryKey: householdId ? qk.pantry(householdId) : ['pantry', 'none'],
    queryFn: () => api<ListPantryResponse>(`/api/households/${householdId}/pantry`),
    enabled: !!householdId,
  })
}

export function useCreatePantryItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreatePantryItemRequest) =>
      api<CreatePantryItemResponse>(`/api/households/${householdId}/pantry`, { method: 'POST', body: req, label: 'Add pantry item' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pantry(householdId) }),
  })
}

export function usePatchPantryItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchPantryItemRequest }) =>
      api<{ item: PantryItem }>(`/api/households/${householdId}/pantry/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pantry(householdId) }),
  })
}

export function useDeletePantryItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/households/${householdId}/pantry/${id}`, { method: 'DELETE', label: 'Remove pantry item' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pantry(householdId) }),
  })
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export function useBudgets(householdId: string | null) {
  return useQuery<ListBudgetsResponse>({
    queryKey: householdId ? qk.budgets(householdId) : ['budgets', 'none'],
    queryFn: () => api<ListBudgetsResponse>(`/api/households/${householdId}/budgets`),
    enabled: !!householdId,
  })
}

export function useCreateBudget(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateBudgetRequest) =>
      api<CreateBudgetResponse>(`/api/households/${householdId}/budgets`, { method: 'POST', body: req, label: 'Set budget' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.budgets(householdId) }),
  })
}

export function usePatchBudget(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchBudgetRequest }) =>
      api<{ budget: Budget }>(`/api/households/${householdId}/budgets/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.budgets(householdId) }),
  })
}

export function useDeleteBudget(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/households/${householdId}/budgets/${id}`, { method: 'DELETE', label: 'Remove budget' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.budgets(householdId) }),
  })
}

// ─── Prices ───────────────────────────────────────────────────────────────────

export function usePriceObservations(householdId: string | null, itemName?: string) {
  return useQuery<ListPriceObservationsResponse>({
    queryKey: householdId
      ? [...qk.prices(householdId), itemName ?? 'all']
      : ['prices', 'none'],
    queryFn: () =>
      api<ListPriceObservationsResponse>(
        `/api/households/${householdId}/price-observations${itemName ? `?itemName=${encodeURIComponent(itemName)}` : ''}`,
      ),
    enabled: !!householdId,
  })
}

export function useCreatePriceObservation(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreatePriceObservationRequest) =>
      api<CreatePriceObservationResponse>(`/api/households/${householdId}/price-observations`, {
        method: 'POST',
        body: req,
        label: 'Save price',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.prices(householdId) }),
  })
}

export function useDeletePriceObservation(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/households/${householdId}/price-observations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.prices(householdId) }),
  })
}

export function usePriceCompare(householdId: string | null, listId: string | null) {
  return useQuery<PriceCompareResponse>({
    queryKey: householdId && listId ? qk.priceCompare(householdId, listId) : ['price-compare', 'none'],
    queryFn: () =>
      api<PriceCompareResponse>(`/api/households/${householdId}/price-compare?listId=${listId}`),
    enabled: !!householdId && !!listId,
  })
}

// ─── Products (catalog favorites) ─────────────────────────────────────────────

export function useProducts(householdId: string | null) {
  return useQuery<ListProductsResponse>({
    queryKey: householdId ? qk.products(householdId) : ['products', 'none'],
    queryFn: () => api<ListProductsResponse>(`/api/households/${householdId}/products`),
    enabled: !!householdId,
  })
}

export function useCreateProduct(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateProductRequest) =>
      api<CreateProductResponse>(`/api/households/${householdId}/products`, { method: 'POST', body: req, label: 'Save product' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.products(householdId) }),
  })
}

export function usePatchProduct(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchProductRequest }) =>
      api<{ product: Product }>(`/api/products/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.products(householdId) }),
  })
}

export function useDeleteProduct(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE', label: 'Remove product' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.products(householdId) }),
  })
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function useEvents(householdId: string | null) {
  return useQuery<ListEventsResponse>({
    queryKey: householdId ? qk.events(householdId) : ['events', 'none'],
    queryFn: () => api<ListEventsResponse>(`/api/households/${householdId}/events`),
    enabled: !!householdId,
  })
}

export function useEvent(id: string | null) {
  return useQuery<{ event: HouseholdEvent }>({
    queryKey: id ? qk.event(id) : ['event', 'none'],
    queryFn: () => api<{ event: HouseholdEvent }>(`/api/events/${id}`),
    enabled: !!id,
  })
}

export function useCreateEvent(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateEventRequest) =>
      api<CreateEventResponse>(`/api/households/${householdId}/events`, { method: 'POST', body: req, label: 'Plan event' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

export function usePatchEvent(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchEventRequest }) =>
      api<{ event: HouseholdEvent }>(`/api/events/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

export function useDeleteEvent(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE', label: 'Delete event' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

export function useCreateEventItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, req }: { eventId: string; req: CreateEventItemRequest }) =>
      api<CreateEventItemResponse>(`/api/events/${eventId}/items`, { method: 'POST', body: req, label: 'Add event item' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

export function usePatchEventItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchEventItemRequest }) =>
      api<{ item: { id: string } }>(`/api/event-items/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

export function useDeleteEventItem(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/event-items/${id}`, { method: 'DELETE', label: 'Remove event item' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

export function useCopyEventToList(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, listId }: { eventId: string; listId: string }) =>
      api<{ copied: number; skipped: number }>(`/api/events/${eventId}/copy-to-list`, {
        method: 'POST',
        body: { listId },
        label: 'Copy to list',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list'] })
      qc.invalidateQueries({ queryKey: qk.lists(householdId) })
      qc.invalidateQueries({ queryKey: qk.events(householdId) })
    },
  })
}

export function useDuplicateEvent(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, asTemplate, name }: { eventId: string; asTemplate?: boolean; name?: string }) =>
      api<{ event: HouseholdEvent }>(`/api/events/${eventId}/duplicate`, {
        method: 'POST',
        body: { asTemplate: asTemplate ?? false, name },
        label: asTemplate ? 'Save template' : 'Duplicate event',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events(householdId) }),
  })
}

// ─── Activity & history ───────────────────────────────────────────────────────

export function useActivity(householdId: string | null) {
  return useQuery<ListActivityResponse>({
    queryKey: householdId ? qk.activity(householdId) : ['activity', 'none'],
    queryFn: () => api<ListActivityResponse>(`/api/households/${householdId}/activity`),
    enabled: !!householdId,
    refetchInterval: 60_000,
  })
}

export function useHistory(householdId: string | null) {
  return useQuery<ListHistoryResponse>({
    queryKey: householdId ? qk.history(householdId) : ['history', 'none'],
    queryFn: () => api<ListHistoryResponse>(`/api/households/${householdId}/history`),
    enabled: !!householdId,
  })
}

// ─── Catalog search ───────────────────────────────────────────────────────────

export function useCatalogSearch(householdId: string | null, query: CatalogSearchQuery) {
  const q = query.q ?? ''
  const section = query.section ?? 'ALL'
  return useQuery<CatalogSearchResponse>({
    queryKey: qk.catalog(`${householdId ?? 'none'}:${q}:${section}`),
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (householdId) params.set('householdId', householdId)
      if (section && section !== 'ALL') params.set('section', section)
      const qs = params.toString()
      return api<CatalogSearchResponse>(`/api/catalog${qs ? `?${qs}` : ''}`)
    },
    enabled: true,
    staleTime: 60_000,
  })
}

// ─── Demo login (mobile-specific convenience) ─────────────────────────────────

export function useDemoSeed() {
  return useMutation({
    mutationFn: () =>
      api<{ ok: boolean; demo: { householdId: string; accounts: { email: string; password: string }[] } }>(
        '/api/demo/seed',
        { method: 'POST', noOfflineQueue: true, label: 'Seed demo data' },
      ),
  })
}
