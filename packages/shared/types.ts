// ShopNest shared client types (mirror API responses).
//
// These types are intentionally framework-agnostic (no React, no 'use client')
// so that both the Next.js web app and the Expo/React Native mobile app can
// import them. Keep this file in sync with the API response shapes.
//
// Note: Role / ItemStatus / CommentKind / StoreCategory / EventType /
// ItemCategory / Unit type aliases live in ./constants (they're derived from
// the const tuples there) and are re-exported via the package index.

import type { ItemStatus, Role } from './constants'

export type { Role, ItemStatus, CommentKind, StoreCategory, EventType, ItemCategory, Unit } from './constants'

export type Me = {
  largeText?: boolean
  notifyPrefs?: string | null
  id: string
  email: string
  name: string
  avatarColor: string
  isAdmin: boolean
  isSuspended: boolean
  emailVerified: boolean
  createdAt: string
}

export type MyHousehold = {
  id: string
  name: string
  plan: 'FREE' | 'PLUS'
  inviteCode: string
  role: Role
  joinedAt: string
}

export type Member = {
  id: string
  role: Role
  joinedAt: string
  user: { id: string; name: string; email: string; avatarColor: string; isSuspended: boolean }
}

export type HouseholdDetail = {
  id: string
  name: string
  inviteCode: string
  plan: 'FREE' | 'PLUS'
  createdAt: string
  members: Member[]
  _count: { lists: number; items: number; stores: number; products: number; events: number }
}

export type Store = {
  id: string
  name: string
  category: string
  address: string | null
  notes: string | null
  isFavorite: boolean
  verified: boolean
  _count?: { items: number; lists: number }
}

export type ListCounts = { total: number; pending: number; purchased: number; unavailable: number }

export type ShoppingList = {
  id: string
  householdId: string
  name: string
  emoji: string
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  storeId: string | null
  store?: { id: string; name: string; category: string } | null
  createdAt: string
  updatedAt: string
  counts?: ListCounts
}

export type ItemPhoto = { id: string; dataUrl: string; createdAt: string; uploadedById: string }

export type ItemComment = {
  id: string
  kind: 'COMMENT' | 'APPROVE' | 'REJECT' | 'SUBSTITUTE'
  text: string
  createdAt: string
  user: { id: string; name: string; avatarColor: string }
}

export type ShoppingItem = {
  id: string
  listId: string
  householdId: string
  name: string
  nameBn: string | null
  quantity: number
  unit: string
  note: string | null
  category: string
  status: ItemStatus
  substitutedWith: string | null
  storeId: string | null
  store?: { id: string; name: string; category: string } | null
  isRecurring: boolean
  favoriteProductId: string | null
  addedById: string
  addedBy?: { id: string; name: string; avatarColor: string }
  purchasedById: string | null
  purchasedBy?: { id: string; name: string; avatarColor: string } | null
  purchasedAt: string | null
  createdAt: string
  updatedAt: string
  photos?: ItemPhoto[]
  comments?: ItemComment[]
}

export type ListDetail = ShoppingList & {
  items: ShoppingItem[]
}

export type HouseholdProduct = {
  id: string
  name: string
  nameBn: string | null
  category: string
  defaultQty: number
  unit: string
  storeId: string | null
  aliases?: string | null // JSON string[] of household-level aliases
  store?: { id: string; name: string; category: string } | null
  isFavorite: boolean
  isRecurring: boolean
  recurrenceDays: number | null
  lastPurchasedAt: string | null
  timesPurchased: number
}

export type HistoryItem = ShoppingItem & { list: { id: string; name: string } | null }

export type Activity = {
  id: string
  type: string
  message: string
  createdAt: string
  user?: { id: string; name: string; avatarColor: string } | null
}

export type EventItem = {
  id: string
  name: string
  quantity: number
  unit: string
  category: string
  storeId: string | null
  store?: { id: string; name: string; category: string } | null
  isDone: boolean
}

export type HouseholdEvent = {
  id: string
  name: string
  type: string
  date: string | null
  guestCount: number | null
  budget: number | null
  notes: string | null
  status: 'PLANNING' | 'COMPLETED'
  items: EventItem[]
}

// ─── V2 types ────────────────────────────────────────────────────────────────

export type ShoppingSessionT = {
  id: string
  householdId: string
  listId: string | null
  storeId: string | null
  status: 'ACTIVE' | 'FINISHED'
  startedAt: string
  finishedAt: string | null
  purchasedCount: number
  unavailableCount: number
  remainingCount: number
  spentCents: number
  currency: string
  store?: { id: string; name: string } | null
  list?: { id: string; name: string } | null
}

export type OutstandingGroup = {
  storeId: string
  storeName: string
  category: string
  items: {
    id: string
    name: string
    nameBn: string | null
    quantity: number
    unit: string
    note: string | null
    category: string
    listId: string
    listName: string
    estimatedPriceCents: number | null
  }[]
}

// Extended EventItem with assignment & shopping link (returned by events API).
export type EventItemT = {
  id: string
  name: string
  quantity: number
  unit: string
  category: string
  storeId: string | null
  store?: { id: string; name: string } | null
  isDone: boolean
  assignedToId: string | null
  assignedTo?: { id: string; name: string; avatarColor: string } | null
  shoppingItemId: string | null
}

// ─── V2 entities used by mobile screens ──────────────────────────────────────

export type PantryItem = {
  id: string
  name: string
  nameBn: string | null
  category: string
  quantity: number | null
  unit: string | null
  status: 'IN_STOCK' | 'RUNNING_LOW' | 'OUT_OF_STOCK' | 'UNKNOWN'
  householdProductId: string | null
  householdProduct?: { id: string; name: string } | null
  notes: string | null
  createdAt: string
  lastUpdatedAt: string
}

export type BudgetScope = 'TRIP' | 'WEEKLY' | 'MONTHLY' | 'EVENT'

export type Budget = {
  id: string
  householdId: string
  scope: BudgetScope
  listId: string | null
  eventId: string | null
  amountCents: number
  currency: string
  periodStart: string | null
  createdAt: string
  updatedAt: string
  spendCents?: number
  list?: { id: string; name: string; emoji: string } | null
  event?: { id: string; name: string } | null
}

export type PriceObservation = {
  id: string
  householdId: string
  productId: string | null
  itemName: string
  nameBn: string | null
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
  observedById: string
  notes: string | null
  store?: { id: string; name: string } | null
  observedBy?: { id: string; name: string; avatarColor: string } | null
}

export type PriceCompareRow = {
  storeId: string
  storeName: string
  isFavorite: boolean
  estimatedTotalCents: number
  matched: number
  missingCount: number
  missing: string[]
  staleUsed: string[]
}

export type ConfirmationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBSTITUTE_SUGGESTED'
  | 'CANCELLED'

export type ConfirmationRequest = {
  id: string
  itemId: string
  householdId: string
  requestedById: string
  photoId: string | null
  note: string | null
  status: ConfirmationStatus
  decidedById: string | null
  decidedAt: string | null
  decisionNote: string | null
  substituteName: string | null
  version: number
  createdAt: string
  updatedAt: string
  photo?: { id: string; dataUrl: string } | null
  requestedBy?: { id: string; name: string; avatarColor: string } | null
  decidedBy?: { id: string; name: string; avatarColor: string } | null
  item?: { id: string; name: string; listId?: string } | null
}

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

export type CatalogSearchResult = {
  catalog: Array<{
    name: string
    nameBn: string | null
    category: string
    defaultQty: number
    unit: string
    aliases: string[]
  }>
  household: Array<{
    id: string
    name: string
    nameBn: string | null
    category: string
    defaultQty: number
    unit: string
    aliases: string[]
  }>
  query: string
}
