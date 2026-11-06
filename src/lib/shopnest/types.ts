// ShopNest client-side types (mirror API responses)

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ItemStatus = 'PENDING' | 'PURCHASED' | 'UNAVAILABLE' | 'SUBSTITUTED'

export type Me = {
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

export type AdminStats = {
  users: { total: number; suspended: number; newThisWeek: number }
  households: { total: number; plus: number; free: number }
  engagement: { dau: number; wau: number; mau: number }
  shopping: { lists: number; items: number; purchasedItems: number }
  billing: { paymentsEnabled: false; mrr: number; payingHouseholds: number; note: string }
  storage: { photos: number; bytes: number }
  meta: { generatedAt: string }
}

export type AdminUser = {
  id: string
  name: string
  email: string
  isAdmin: boolean
  isSuspended: boolean
  createdAt: string
  lastActiveAt: string
  _count: { memberships: number }
}
