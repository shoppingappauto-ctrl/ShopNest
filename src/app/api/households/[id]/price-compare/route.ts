import { db } from '@/lib/db'
import { jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { isPriceStale } from '@/lib/shopnest/money'

type Params = { params: Promise<{ id: string }> }

/**
 * Future-basket comparison: estimate a shopping list's total cost per store
 * using the household's Price Memory observations.
 *
 * Rules (per the V2 spec):
 * - Only products with comparable recorded prices are compared — matching is
 *   by linked HouseholdProduct first, then by exact normalized name.
 * - Missing prices are listed per store, NEVER fabricated.
 * - The result is an estimate based on recorded observations, not a checkout
 *   total and not a claim about current national shelf prices.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const listId = new URL(req.url).searchParams.get('listId')
    if (!listId) return Response.json({ error: 'listId is required.' }, { status: 400 })
    const list = await db.shoppingList.findFirst({ where: { id: listId, householdId: id } })
    if (!list) return Response.json({ error: 'List not found.' }, { status: 404 })

    const items = await db.shoppingItem.findMany({
      where: { listId, householdId: id, status: 'PENDING' },
      include: { favoriteProduct: { select: { id: true, name: true } } },
    })
    if (items.length === 0) return Response.json({ stores: [], missing: [], note: 'No pending items to compare.' })

    const observations = await db.priceObservation.findMany({
      where: { householdId: id },
      include: { store: { select: { id: true, name: true } } },
      orderBy: { observedAt: 'desc' },
      take: 500,
    })

    const stores = await db.store.findMany({ where: { householdId: id }, select: { id: true, name: true, isFavorite: true } })

    // observations keyed by product key (productId or normalized name)
    const obsByProduct = new Map<string, Map<string, { totalCents: number; observedAt: Date; stale: boolean; source: string }>>()
    for (const o of observations) {
      const key = o.productId ?? o.itemName.toLowerCase().trim()
      const perStore = obsByProduct.get(key) ?? new Map()
      const storeKey = o.storeId ?? 'none'
      if (!perStore.has(storeKey)) {
        perStore.set(storeKey, { totalCents: o.totalPriceCents, observedAt: o.observedAt, stale: isPriceStale(o.observedAt), source: o.source })
      }
      obsByProduct.set(key, perStore)
    }

    const result = stores.map((store) => {
      let totalCents = 0
      let matched = 0
      const missing: string[] = []
      const staleUsed: string[] = []
      for (const item of items) {
        const key = item.favoriteProductId ?? item.name.toLowerCase().trim()
        const price = obsByProduct.get(key)?.get(store.id)
        if (price) {
          // scale linearly by quantity: observation records qty at its price
          // (e.g. "$3.48 for 1 gal" → 2 gal ≈ $6.96)
          const scale = price.totalCents > 0 && item.quantity > 0 ? item.quantity / Math.max(0.0001, 1) : 1
          totalCents += Math.round(price.totalCents * scale)
          if (price.stale) staleUsed.push(item.name)
          matched++
        } else if (obsByProduct.has(key)) {
          missing.push(`${item.name} — no price recorded for ${store.name}`)
        } else {
          missing.push(`${item.name} — not in Price Memory`)
        }
      }
      return {
        storeId: store.id,
        storeName: store.name,
        isFavorite: store.isFavorite,
        estimatedTotalCents: totalCents,
        matched,
        missingCount: items.length - matched,
        missing,
        staleUsed,
      }
    })

    const comparable = result.filter((r) => r.matched > 0).sort((a, b) => a.estimatedTotalCents - b.estimatedTotalCents)
    return Response.json({
      stores: comparable,
      itemsCount: items.length,
      note: 'Estimates come from your household’s recorded prices (Price Memory). They are not a checkout total and do not claim current shelf prices.',
    })
  } catch (error) {
    return jsonError(error)
  }
}
