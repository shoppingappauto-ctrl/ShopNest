/**
 * ShopNest — typed API request/response shapes for every backend route.
 *
 * Derived from the Next.js Route Handlers in /src/app/api. Request bodies use
 * the zod-validated shape (camelCase). Responses wrap entities in a single-key
 * envelope (e.g. `{ list }`, `{ items: [...] }`).
 *
 * Framework-agnostic: no React, no 'use client'. Imported by web and mobile.
 */

import type {
  Activity,
  Budget,
  BudgetScope,
  CatalogSearchResult,
  ConfirmationRequest,
  ConfirmationStatus,
  HouseholdDetail,
  HouseholdEvent,
  HouseholdProduct,
  HistoryItem,
  ItemComment,
  ItemPhoto,
  ListDetail,
  Me,
  MyHousehold,
  OutstandingGroup,
  PantryItem,
  PriceCompareRow,
  PriceObservation,
  ShoppingItem,
  ShoppingList,
  ShoppingSessionT,
  Store,
} from './types'
import type {
  EventType,
  ItemCategory,
  ItemStatus,
  StoreCategory,
  Unit,
} from './constants'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}
export interface AuthUserPublic {
  id: string
  email: string
  name: string
  isAdmin: boolean
}
export interface LoginResponse {
  user: AuthUserPublic
  token: string
}
export interface RegisterRequest {
  name: string
  email: string
  password: string
}
export type RegisterResponse = LoginResponse

export interface MeResponse {
  user: (Me & { notifyPrefs: string | null; largeText: boolean }) | null
  households: MyHousehold[]
}

export interface UpdatePrefsRequest {
  notifyPrefs?: Partial<{ purchases: boolean; comments: boolean; reminders: boolean }>
  largeText?: boolean
  name?: string
}
export interface UpdatePrefsResponse {
  user: { id: string; name: string; notifyPrefs: string | null; largeText: boolean }
}

export interface RefreshResponse {
  ok: boolean
  refreshed: boolean
  expiresAt: string | null
}

// ─── Households ───────────────────────────────────────────────────────────────

export interface ListHouseholdsResponse {
  households: MyHousehold[]
}
export interface CreateHouseholdRequest {
  name: string
}
export interface CreateHouseholdResponse {
  household: { id: string; name: string; inviteCode: string; plan: string }
}
export interface JoinHouseholdRequest {
  inviteCode: string
}
export interface JoinHouseholdResponse {
  household: { id: string; name: string }
}
export interface GetHouseholdResponse {
  household: HouseholdDetail
}
export interface PatchHouseholdRequest {
  name: string
}
export interface LeaveHouseholdResponse {
  ok: boolean
}
export interface RotateInviteResponse {
  inviteCode: string
}
export interface UpdateMemberRoleRequest {
  role: 'ADMIN' | 'MEMBER'
}

// ─── Stores ───────────────────────────────────────────────────────────────────

export interface ListStoresResponse {
  stores: Store[]
}
export interface CreateStoreRequest {
  name: string
  category: StoreCategory
  address?: string | null
  notes?: string | null
  isFavorite?: boolean
}
export interface CreateStoreResponse {
  store: Store
}
export interface PatchStoreRequest {
  name?: string
  category?: StoreCategory
  address?: string | null
  notes?: string | null
  isFavorite?: boolean
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export interface ListListsResponse {
  lists: ShoppingList[]
}
export interface CreateListRequest {
  name: string
  emoji?: string
  storeId?: string | null
}
export interface CreateListResponse {
  list: ShoppingList
}
export interface GetListResponse {
  list: ListDetail
}
export interface PatchListRequest {
  name?: string
  emoji?: string
  storeId?: string | null
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
}
export type ListResponse = { list: ShoppingList }

// ─── Items ────────────────────────────────────────────────────────────────────

export interface CreateItemRequest {
  name: string
  nameBn?: string | null
  quantity?: number
  unit?: Unit
  note?: string | null
  category?: ItemCategory
  storeId?: string | null
  favoriteProductId?: string | null
  isRecurring?: boolean
  estimatedPriceCents?: number | null
}
export interface CreateItemResponse {
  item: ShoppingItem
}
export interface PatchItemRequest {
  name?: string
  quantity?: number
  unit?: Unit
  note?: string | null
  category?: ItemCategory
  storeId?: string | null
  status?: ItemStatus
  substitutedWith?: string | null
  isRecurring?: boolean
  estimatedPriceCents?: number | null
  actualPriceCents?: number | null
}
export type ItemResponse = { item: ShoppingItem }

export interface AddItemPhotoRequest {
  dataUrl: string
}
export interface AddItemPhotoResponse {
  photo: ItemPhoto
}

export interface AddCommentRequest {
  kind?: 'COMMENT' | 'APPROVE' | 'REJECT' | 'SUBSTITUTE'
  text: string
}
export interface AddCommentResponse {
  comment: ItemComment
}

// ─── Confirmations ────────────────────────────────────────────────────────────

export interface CreateItemConfirmationRequest {
  note?: string | null
  photoDataUrl?: string | null
}
export interface CreateItemConfirmationResponse {
  request: ConfirmationRequest
}
export interface ListItemConfirmationsResponse {
  requests: ConfirmationRequest[]
}

export interface ListHouseholdConfirmationsQuery {
  status?: ConfirmationStatus
}
export interface ListHouseholdConfirmationsResponse {
  requests: ConfirmationRequest[]
}
export interface CreateHouseholdConfirmationRequest {
  itemId: string
  note?: string
}
export interface CreateHouseholdConfirmationResponse {
  request: ConfirmationRequest
}

export interface DecideConfirmationRequest {
  action: 'decide' | 'cancel'
  decision?: 'APPROVED' | 'REJECTED' | 'SUBSTITUTE_SUGGESTED'
  note?: string | null
  substituteName?: string | null
  version?: number
}
export interface DecideConfirmationResponse {
  request: ConfirmationRequest
}

// ─── Outstanding (grouped by store) ────────────────────────────────────────────

export interface OutstandingResponse {
  groups: OutstandingGroup[]
}

// ─── Shopping sessions ─────────────────────────────────────────────────────────

export interface StartSessionRequest {
  listId?: string | null
  storeId?: string | null
}
export interface StartSessionResponse {
  session: ShoppingSessionT
}
export interface ListSessionsResponse {
  sessions: ShoppingSessionT[]
}
export interface GetSessionResponse {
  session: ShoppingSessionT
}
export interface FinishSessionResponse {
  session: ShoppingSessionT
  summary: {
    purchased: { id: string; name: string; quantity: number; unit: string; priceCents: number | null }[]
    unavailable: { id: string; name: string }[]
    remaining: { id: string; name: string }[]
  }
}

// ─── Pantry ───────────────────────────────────────────────────────────────────

export interface ListPantryResponse {
  items: PantryItem[]
}
export interface CreatePantryItemRequest {
  name: string
  nameBn?: string | null
  category?: string
  quantity?: number | null
  unit?: string | null
  status?: 'IN_STOCK' | 'RUNNING_LOW' | 'OUT_OF_STOCK' | 'UNKNOWN'
  householdProductId?: string | null
  notes?: string | null
}
export interface CreatePantryItemResponse {
  item: PantryItem
}
export interface PatchPantryItemRequest {
  quantity?: number | null
  unit?: string | null
  status?: 'IN_STOCK' | 'RUNNING_LOW' | 'OUT_OF_STOCK' | 'UNKNOWN'
  notes?: string | null
}
export type PantryItemResponse = { item: PantryItem }

// ─── Budgets ──────────────────────────────────────────────────────────────────

export interface ListBudgetsResponse {
  budgets: Budget[]
}
export interface CreateBudgetRequest {
  scope: BudgetScope
  listId?: string | null
  eventId?: string | null
  amountCents: number
  periodStart?: string | null
}
export interface CreateBudgetResponse {
  budget: Budget
}
export interface PatchBudgetRequest {
  amountCents: number
}

// ─── Price observations & compare ─────────────────────────────────────────────

export interface ListPriceObservationsQuery {
  itemName?: string
  productId?: string
}
export interface ListPriceObservationsResponse {
  observations: PriceObservation[]
  byProduct: Array<{
    itemName: string
    nameBn: string | null
    productId: string | null
    stores: Array<{
      storeId: string | null
      storeName: string
      latest: {
        totalPriceCents: number
        quantity: number
        unit: string
        unitPriceCents: number | null
        basis: string | null
        observedAt: string
        stale: boolean
        source: string
      }
      lowestTotalPriceCents: number
    }>
  }>
}
export interface CreatePriceObservationRequest {
  itemName: string
  nameBn?: string | null
  productId?: string | null
  storeId?: string | null
  quantity?: number
  unit?: string
  packageSize?: string | null
  totalPriceCents: number
  source?: 'USER_ENTERED' | 'RECEIPT' | 'RETAILER_AUTHORIZED' | 'PARTNER_FEED' | 'COMMUNITY'
  notes?: string | null
}
export interface CreatePriceObservationResponse {
  observation: PriceObservation
}

export interface PriceCompareResponse {
  stores: PriceCompareRow[]
  itemsCount: number
  note: string
}

// ─── Products (household catalog favorites) ──────────────────────────────────

export interface ListProductsResponse {
  products: HouseholdProduct[]
}
export interface CreateProductRequest {
  name: string
  nameBn?: string | null
  category?: ItemCategory
  defaultQty?: number
  unit?: Unit
  storeId?: string | null
  isFavorite?: boolean
  isRecurring?: boolean
  recurrenceDays?: number | null
}
export interface CreateProductResponse {
  product: HouseholdProduct
}
export interface PatchProductRequest {
  name?: string
  nameBn?: string | null
  category?: ItemCategory
  defaultQty?: number
  unit?: Unit
  storeId?: string | null
  isFavorite?: boolean
  isRecurring?: boolean
  recurrenceDays?: number | null
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface ListEventsResponse {
  events: HouseholdEvent[]
}
export interface CreateEventRequest {
  name: string
  type?: EventType | string
  date?: string | null
  guestCount?: number | null
  budget?: number | null
  notes?: string | null
}
export interface CreateEventResponse {
  event: HouseholdEvent
}
export interface PatchEventRequest {
  name?: string
  type?: string
  date?: string | null
  guestCount?: number | null
  budget?: number | null
  notes?: string | null
  status?: 'PLANNING' | 'COMPLETED'
}

export interface CreateEventItemRequest {
  name: string
  quantity?: number
  unit?: Unit
  category?: ItemCategory
  storeId?: string | null
}
export interface CreateEventItemResponse {
  item: import('./types').EventItemT
}
export interface PatchEventItemRequest {
  name?: string
  quantity?: number
  unit?: Unit
  category?: ItemCategory
  isDone?: boolean
  storeId?: string | null
  assignedToId?: string | null
}

export interface CopyEventToListRequest {
  listId: string
}
export interface CopyEventToListResponse {
  copied: number
  skipped: number
}

export interface DuplicateEventRequest {
  name?: string
  date?: string | null
  asTemplate?: boolean
}
export interface DuplicateEventResponse {
  event: HouseholdEvent
}

// ─── Activity & history ───────────────────────────────────────────────────────

export interface ListActivityResponse {
  activities: Activity[]
}
export interface ListHistoryResponse {
  items: HistoryItem[]
}

// ─── Catalog search ───────────────────────────────────────────────────────────

export interface CatalogSearchQuery {
  q?: string
  householdId?: string
  section?: string
}
export type CatalogSearchResponse = CatalogSearchResult

// ─── Demo ─────────────────────────────────────────────────────────────────────

export interface DemoSeedResponse {
  ok: boolean
  demo: {
    householdId: string
    accounts: Array<{ email: string; name: string; password: string; role: string }>
  }
}
