import { db } from '@/lib/db'
import { jsonError, requireUser } from '@/lib/shopnest/auth'

/**
 * Specialty catalog search (Feature Five).
 *
 * - Searches the curated global catalog (English, Bangla, transliteration
 *   and curated aliases — "ilish" finds "Hilsa fish (Ilish)").
 * - ALSO searches the household's own saved products (including their
 *   household-level aliases) when `householdId` is provided.
 * - Halal tags are informational (retailer-style descriptions) — the API
 *   never certifies anything.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
    const householdId = url.searchParams.get('householdId')
    const section = url.searchParams.get('section')

    let householdProducts: {
      id: string
      name: string
      nameBn: string | null
      category: string
      defaultQty: number
      unit: string
      aliases: string[]
    }[] = []
    if (householdId) {
      const rows = await db.householdProduct.findMany({
        where: { householdId },
        select: { id: true, name: true, nameBn: true, category: true, defaultQty: true, unit: true, aliases: true },
      })
      householdProducts = rows.map((r) => ({ ...r, aliases: safeParseAliases(r.aliases) }))
    }

    const match = (haystacks: (string | null | undefined)[]) =>
      q.length === 0 ? true : haystacks.some((h) => h?.toLowerCase().includes(q))

    const catalog = (await import('@/lib/shopnest/constants')).SPECIALTY_CATALOG.filter((entry) => {
      if (section && section !== 'ALL') {
        // light section mapping — fish & produce from BD/South Asian categories
        const isBd = entry.preferredStoreCategory === 'BANGLADESHI'
        const isHalal = entry.dietary?.includes('HALAL_RETAILER_DECLARED')
        const isFish = entry.category === 'FISH'
        const isAmerican = entry.preferredStoreCategory === 'SUPERMARKET' && !isBd && !isHalal && !isFish
        if (section === 'BANGLADESHI' && !(isBd && !isFish)) return false
        if (section === 'HALAL' && !isHalal) return false
        if (section === 'SOUTH_ASIAN_FISH' && !isFish) return false
        if (section === 'AMERICAN' && !isAmerican) return false
        if ((section === 'SOUTH_ASIAN' || section === 'MIDDLE_EASTERN' || section === 'HOUSEHOLD_STAPLES') && false) return false
      }
      return true
    })
      .filter((e) => match([e.name, e.nameBn, ...(e.aliases ?? [])]))
      .slice(0, 40)

    const household = householdProducts.filter((p) => match([p.name, p.nameBn, ...p.aliases])).slice(0, 20)

    return Response.json({ catalog, household, query: q })
  } catch (error) {
    return jsonError(error)
  }
}

function safeParseAliases(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
