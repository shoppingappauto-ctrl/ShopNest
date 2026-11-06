// ShopNest shared constants & catalogs (used by API and client)

export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const
export type Role = (typeof ROLES)[number]

export const ITEM_STATUSES = ['PENDING', 'PURCHASED', 'UNAVAILABLE', 'SUBSTITUTED'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const COMMENT_KINDS = ['COMMENT', 'APPROVE', 'REJECT', 'SUBSTITUTE'] as const
export type CommentKind = (typeof COMMENT_KINDS)[number]

export const STORE_CATEGORIES = [
  'SUPERMARKET',
  'HALAL',
  'BANGLADESHI',
  'ASIAN',
  'BUTCHER',
  'FISH',
  'OTHER',
] as const
export type StoreCategory = (typeof STORE_CATEGORIES)[number]

export const EVENT_TYPES = [
  'BIRTHDAY',
  'EID',
  'RAMADAN',
  'WEDDING',
  'GATHERING',
  'BBQ',
  'HOLIDAY',
  'BABY_SHOWER',
  'OTHER',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const ITEM_CATEGORIES = [
  'PRODUCE',
  'MEAT',
  'FISH',
  'DAIRY',
  'BAKERY',
  'PANTRY',
  'FROZEN',
  'DRINKS',
  'HOUSEHOLD',
  'BABY',
  'OTHER',
] as const
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

export const UNITS = ['pc', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'pack', 'dozen', 'bunch'] as const
export type Unit = (typeof UNITS)[number]

export const PLUS_PRICE_PER_MONTH = 3.99

// Curated specialty catalog: Bangladeshi, halal & household staples.
// Used for one-tap re-add; halal certification is NEVER claimed — the tag is user-entered only.
export const SPECIALTY_CATALOG: {
  name: string
  nameBn?: string
  category: ItemCategory
  defaultQty: number
  unit: Unit
  preferredStoreCategory?: StoreCategory
}[] = [
  { name: 'Hilsa fish (Ilish)', nameBn: 'ইলিশ', category: 'FISH', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Rohu fish', nameBn: 'রুই', category: 'FISH', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Catla fish', nameBn: 'কাতলা', category: 'FISH', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Halal chicken (whole)', category: 'MEAT', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'HALAL' },
  { name: 'Halal chicken (curry cut)', category: 'MEAT', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'HALAL' },
  { name: 'Halal beef', category: 'MEAT', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'HALAL' },
  { name: 'Goat meat (khashi)', category: 'MEAT', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'HALAL' },
  { name: 'Basmati rice', nameBn: 'বাসমতী চাল', category: 'PANTRY', defaultQty: 5, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Aromatic rice (chinigura)', nameBn: 'চিনিগুড়া চাল', category: 'PANTRY', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Mustard oil', nameBn: 'সরিষার তেল', category: 'PANTRY', defaultQty: 1, unit: 'L', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Green chilies', nameBn: 'কাঁচা মরিচ', category: 'PRODUCE', defaultQty: 200, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Coriander leaves', nameBn: 'ধনে পাতা', category: 'PRODUCE', defaultQty: 2, unit: 'bunch', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Bottle gourd (lau)', nameBn: 'লাউ', category: 'PRODUCE', defaultQty: 1, unit: 'pc', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Bitter gourd (korola)', nameBn: 'করলা', category: 'PRODUCE', defaultQty: 500, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Red lentils (masoor dal)', nameBn: 'মসুর ডাল', category: 'PANTRY', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Yellow lentils (mung dal)', nameBn: 'মুগ ডাল', category: 'PANTRY', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Chickpea flour (besan)', nameBn: 'বেসন', category: 'PANTRY', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Panch phoron (five spice)', nameBn: 'পাঁচ ফোড়ন', category: 'PANTRY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Milk', category: 'DAIRY', defaultQty: 2, unit: 'L', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Bread', category: 'BAKERY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Eggs', category: 'DAIRY', defaultQty: 1, unit: 'dozen', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Diapers', category: 'BABY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Baby wipes', category: 'BABY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Cooking oil', category: 'PANTRY', defaultQty: 2, unit: 'L', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Detergent', category: 'HOUSEHOLD', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Toilet paper', category: 'HOUSEHOLD', defaultQty: 12, unit: 'pc', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Onions', nameBn: 'পিঁয়াজ', category: 'PRODUCE', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Potatoes', nameBn: 'আলু', category: 'PRODUCE', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Tomatoes', nameBn: 'টমেটো', category: 'PRODUCE', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Ginger', nameBn: 'আদা', category: 'PRODUCE', defaultQty: 250, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Garlic', nameBn: 'রসুন', category: 'PRODUCE', defaultQty: 250, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Tea leaves (cha pata)', nameBn: 'চা পাতা', category: 'DRINKS', defaultQty: 400, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
]

export const CATEGORY_EMOJI: Record<string, string> = {
  PRODUCE: '🥬',
  MEAT: '🥩',
  FISH: '🐟',
  DAIRY: '🥛',
  BAKERY: '🍞',
  PANTRY: '🧂',
  FROZEN: '🧊',
  DRINKS: '🧃',
  HOUSEHOLD: '🧼',
  BABY: '🍼',
  OTHER: '🛒',
}

export const STORE_CATEGORY_EMOJI: Record<string, string> = {
  SUPERMARKET: '🛒',
  HALAL: '🕌',
  BANGLADESHI: '🇧🇩',
  ASIAN: '🍜',
  BUTCHER: '🔪',
  FISH: '🐟',
  OTHER: '🏬',
}

export const EVENT_TYPE_EMOJI: Record<string, string> = {
  BIRTHDAY: '🎂',
  EID: '🌙',
  RAMADAN: '☪️',
  WEDDING: '💐',
  GATHERING: '🍽️',
  BBQ: '🔥',
  HOLIDAY: '🎉',
  BABY_SHOWER: '🍼',
  OTHER: '📅',
}

// Well-known store suggestions shown when adding stores (user-confirmed, user-entered data)
export const WELL_KNOWN_STORES = [
  'Walmart',
  'Costco',
  'Target',
  'Meijer',
  'Kroger',
  'Aldi',
  'Al Aqsa Halal Market',
  'Bangla Bazar',
  'Local butcher',
  'Fish market',
]

export const CATEGORY_LABEL: Record<string, string> = {
  PRODUCE: 'Produce',
  MEAT: 'Meat',
  FISH: 'Fish',
  DAIRY: 'Dairy & Eggs',
  BAKERY: 'Bakery',
  PANTRY: 'Pantry',
  FROZEN: 'Frozen',
  DRINKS: 'Drinks',
  HOUSEHOLD: 'Household',
  BABY: 'Baby',
  OTHER: 'Other',
}
