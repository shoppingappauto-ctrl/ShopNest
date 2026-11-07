// ShopNest shared constants & catalogs (used by API and client)

export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'CAREGIVER'] as const
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

export const UNITS = ['pc', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'gal', 'pack', 'dozen', 'bunch'] as const
export type Unit = (typeof UNITS)[number]

export const PLUS_PRICE_PER_MONTH = 3.99

// Curated specialty catalog: Bangladeshi, halal, South Asian & household staples.
// - `aliases` power multilingual search (e.g. "ilish" finds "Hilsa fish (Ilish)").
// - `dietary` tags are INFORMATIONAL ONLY: halal tags reflect the catalog's
//   retailer-style description, never an independent certification.
export const SPECIALTY_CATALOG: {
  name: string
  nameBn?: string
  aliases?: string[]
  category: ItemCategory
  defaultQty: number
  unit: Unit
  preferredStoreCategory?: StoreCategory
  dietary?: string[]
}[] = [
  { name: 'Hilsa fish (Ilish)', nameBn: 'ইলিশ', aliases: ['ilish', 'hilsa', 'ish', 'hilsha', 'ইলিশ'], category: 'FISH', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Rohu fish', nameBn: 'রুই', aliases: ['rui', 'rohu', 'রুই'], category: 'FISH', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Catla fish', nameBn: 'কাতলা', aliases: ['katla', 'catla', 'কাতলা'], category: 'FISH', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Halal chicken (whole)', aliases: ['whole chicken', 'মুরগি'], category: 'MEAT', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'HALAL', dietary: ['HALAL_RETAILER_DECLARED'] },
  { name: 'Halal chicken (curry cut)', aliases: ['curry cut chicken', 'chicken'], category: 'MEAT', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'HALAL', dietary: ['HALAL_RETAILER_DECLARED'] },
  { name: 'Halal beef', aliases: ['beef', 'গরুর মাংস'], category: 'MEAT', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'HALAL', dietary: ['HALAL_RETAILER_DECLARED'] },
  { name: 'Goat meat (khashi)', nameBn: 'খাসির মাংস', aliases: ['khashi', 'goat', 'mutton', 'খাসি'], category: 'MEAT', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'HALAL', dietary: ['HALAL_RETAILER_DECLARED'] },
  { name: 'Basmati rice', nameBn: 'বাসমতী চাল', aliases: ['basmati', 'চাল', 'polao rice'], category: 'PANTRY', defaultQty: 5, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Aromatic rice (chinigura)', nameBn: 'চিনিগুড়া চাল', aliases: ['chinigura', 'kalijira'], category: 'PANTRY', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Mustard oil', nameBn: 'সরিষার তেল', aliases: ['sorisha tel', 'সরিষার তেল'], category: 'PANTRY', defaultQty: 1, unit: 'L', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Green chilies', nameBn: 'কাঁচা মরিচ', aliases: ['kacha morich', 'chili', 'মরিচ'], category: 'PRODUCE', defaultQty: 200, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Coriander leaves', nameBn: 'ধনে পাতা', aliases: ['cilantro', 'dhonia', 'ধনে পাতা'], category: 'PRODUCE', defaultQty: 2, unit: 'bunch', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Bottle gourd (lau)', nameBn: 'লাউ', aliases: ['lau', 'lauki', 'লাউ'], category: 'PRODUCE', defaultQty: 1, unit: 'pc', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Bitter gourd (korola)', nameBn: 'করলা', aliases: ['korola', 'karela', 'উচ্ছে'], category: 'PRODUCE', defaultQty: 500, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Red lentils (masoor dal)', nameBn: 'মসুর ডাল', aliases: ['masoor dal', 'musur dal', 'dal', 'ডাল'], category: 'PANTRY', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Yellow lentils (mung dal)', nameBn: 'মুগ ডাল', aliases: ['mung dal', 'mug dal', 'moong dal'], category: 'PANTRY', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Chickpea flour (besan)', nameBn: 'বেসন', aliases: ['besan', 'বেসন'], category: 'PANTRY', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Panch phoron (five spice)', nameBn: 'পাঁচ ফোড়ন', aliases: ['panch foron', 'panch phutana'], category: 'PANTRY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Turmeric powder', nameBn: 'হলুদ গুঁড়া', aliases: ['holud', 'turmeric', 'হলুদ'], category: 'PANTRY', defaultQty: 200, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Milk', category: 'DAIRY', aliases: ['doodh', 'গরুর দুধ'], defaultQty: 2, unit: 'L', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Bread', category: 'BAKERY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Eggs', category: 'DAIRY', aliases: ['dim', 'ডিম'], defaultQty: 1, unit: 'dozen', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Diapers', category: 'BABY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Baby wipes', category: 'BABY', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Cooking oil', category: 'PANTRY', aliases: ['oil', 'তেল'], defaultQty: 2, unit: 'L', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Detergent', category: 'HOUSEHOLD', defaultQty: 1, unit: 'pack', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Toilet paper', category: 'HOUSEHOLD', defaultQty: 12, unit: 'pc', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Onions', nameBn: 'পিঁয়াজ', aliases: ['pyaj', 'onion', 'পিঁয়াজ'], category: 'PRODUCE', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Potatoes', nameBn: 'আলু', aliases: ['alu', 'potato', 'আলু'], category: 'PRODUCE', defaultQty: 2, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Tomatoes', nameBn: 'টমেটো', aliases: ['tomato', 'টমেটো'], category: 'PRODUCE', defaultQty: 1, unit: 'kg', preferredStoreCategory: 'SUPERMARKET' },
  { name: 'Ginger', nameBn: 'আদা', aliases: ['ada', 'আদা'], category: 'PRODUCE', defaultQty: 250, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Garlic', nameBn: 'রসুন', aliases: ['rosun', 'রসুন'], category: 'PRODUCE', defaultQty: 250, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
  { name: 'Tea leaves (cha pata)', nameBn: 'চা পাতা', aliases: ['cha pata', 'tea', 'চা পাতা'], category: 'DRINKS', defaultQty: 400, unit: 'g', preferredStoreCategory: 'BANGLADESHI' },
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

// Catalog categories for the specialty/international browse filter
export const CATALOG_SECTIONS = [
  { key: 'BANGLADESHI', label: 'Bangladeshi groceries' },
  { key: 'HALAL', label: 'Halal meat' },
  { key: 'SOUTH_ASIAN_FISH', label: 'South Asian fish' },
  { key: 'SOUTH_ASIAN', label: 'Indian & Pakistani groceries' },
  { key: 'MIDDLE_EASTERN', label: 'Middle Eastern groceries' },
  { key: 'AMERICAN', label: 'American groceries' },
  { key: 'HOUSEHOLD_STAPLES', label: 'Household staples' },
] as const

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
