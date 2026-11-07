/**
 * ShopNest V2 — decimal-safe money & unit-price helpers.
 *
 * All monetary values are stored as INTEGER minor units (cents) in the
 * database and computed with integer arithmetic. Floating point is never
 * used for money math; parsing uses rounding of the exact decimal string.
 */

/** Parse a user-entered dollar amount ("3.48", "$3.48", "3.5") into integer cents. */
export function dollarsToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  const raw = typeof input === 'number' ? input.toString() : String(input).replace(/[$,\s]/g, '')
  if (!/^\d*(\.\d*)?$/.test(raw) || raw === '' || raw === '.') return null
  const [whole = '0', frac = ''] = raw.split('.')
  const cents = parseInt(whole || '0', 10) * 100 + Math.round(parseInt((frac + '00').slice(0, 2) || '0', 10))
  return Number.isFinite(cents) ? cents : null
}

/** Format integer cents as a display string, e.g. 348 → "$3.48". */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : `${currency} `
  const value = ((cents ?? 0) / 100).toFixed(2)
  return `${symbol}${value}`
}

/** Unit → { basis, factor } normalization table for unit-price comparison. */
const UNIT_FACTORS: Record<string, { basis: string; factor: number }> = {
  // mass → kg
  kg: { basis: 'kg', factor: 1 },
  g: { basis: 'kg', factor: 0.001 },
  lb: { basis: 'kg', factor: 0.453592 },
  oz: { basis: 'kg', factor: 0.0283495 },
  // volume → L
  L: { basis: 'L', factor: 1 },
  ml: { basis: 'L', factor: 0.001 },
  gal: { basis: 'L', factor: 3.78541 },
  qt: { basis: 'L', factor: 0.946353 },
  floz: { basis: 'L', factor: 0.0295735 },
  // count → pc
  pc: { basis: 'pc', factor: 1 },
  dozen: { basis: 'pc', factor: 12 },
  pack: { basis: 'pc', factor: 1 },
  bunch: { basis: 'pc', factor: 1 },
  dozen_bn: { basis: 'pc', factor: 12 },
}

/** Normalize a free-form unit string (case-insensitive, trims plural 's'). */
export function normalizeUnit(unit: string | null | undefined): { basis: string; factor: number } {
  if (!unit) return UNIT_FACTORS.pc
  const u = unit.trim().replace(/s$/i, '').toLowerCase()
  return UNIT_FACTORS[u] ?? UNIT_FACTORS[u.toLowerCase()] ?? UNIT_FACTORS.pc
}

/**
 * Compute the normalized unit price in minor units per canonical basis.
 * e.g. $3.48 for 1 gal → unitPriceCents ≈ 92 /L (factor 3.78541).
 * Returns null when the unit can't be normalized.
 */
export function computeUnitPriceCents(
  totalCents: number,
  quantity: number,
  unit: string
): { unitPriceCents: number; basis: string } | null {
  if (!Number.isFinite(totalCents) || totalCents <= 0 || !Number.isFinite(quantity) || quantity <= 0) return null
  const { basis, factor } = normalizeUnit(unit)
  const unitPriceCents = Math.round(totalCents / (quantity * factor))
  return Number.isFinite(unitPriceCents) && unitPriceCents > 0 ? { unitPriceCents, basis } : null
}

/** A price observation is stale after this many days. */
export const PRICE_STALE_DAYS = 60

export function isPriceStale(observedAt: Date | string): boolean {
  const t = typeof observedAt === 'string' ? new Date(observedAt).getTime() : observedAt.getTime()
  return Date.now() - t > PRICE_STALE_DAYS * 24 * 60 * 60 * 1000
}
