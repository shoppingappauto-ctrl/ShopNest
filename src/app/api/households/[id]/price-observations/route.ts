import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { computeUnitPriceCents, isPriceStale } from '@/lib/shopnest/money'

type Params = { params: Promise<{ id: string }> }

/**
 * Price Memory — household-scoped price observations.
 *
 * ShopNest Price Memory is NOT a live retailer pricing API. It remembers
 * user-entered (or, in future, receipt/partner-derived) prices and compares
 * them. Every observation records its source and is only visible to the
 * household that entered it.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const url = new URL(req.url)
    const itemNameParam = url.searchParams.get('itemName')?.trim()
    const productId = url.searchParams.get('productId')

    const observations = await db.priceObservation.findMany({
      where: {
        householdId: id,
        ...(productId ? { productId } : {}),
      },
      include: {
        store: { select: { id: true, name: true } },
        observedBy: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { observedAt: 'desc' },
      take: 500,
    })
    // case-insensitive product match (SQLite LIKE is case-sensitive for non-ASCII)
    const q = itemNameParam?.toLowerCase()
    const filtered = q ? observations.filter((o) => o.itemName.toLowerCase().includes(q)) : observations

    // group by normalized product name → per-store latest + lowest
    const byProduct = new Map<
      string,
      {
        itemName: string
        nameBn: string | null
        productId: string | null
        stores: {
          storeId: string | null
          storeName: string
          latest: { totalPriceCents: number; quantity: number; unit: string; unitPriceCents: number | null; basis: string | null; observedAt: string; stale: boolean; source: string }
          lowestTotalPriceCents: number
        }[]
      }
    >()

    for (const o of filtered) {
      const key = o.itemName.toLowerCase().trim()
      const entry = byProduct.get(key) ?? {
        itemName: o.itemName,
        nameBn: o.nameBn,
        productId: o.productId,
        stores: [],
      }
      const storeKey = o.storeId ?? 'none'
      const storeEntry = entry.stores.find((s) => s.storeId === o.storeId)
      const stale = isPriceStale(o.observedAt)
      const latest = {
        totalPriceCents: o.totalPriceCents,
        quantity: o.quantity,
        unit: o.unit,
        unitPriceCents: o.unitPriceCents,
        basis: o.unitPriceBasis,
        observedAt: o.observedAt.toISOString(),
        stale,
        source: o.source,
      }
      if (storeEntry) {
        storeEntry.lowestTotalPriceCents = Math.min(storeEntry.lowestTotalPriceCents, o.totalPriceCents)
      } else {
        entry.stores.push({
          storeId: o.storeId,
          storeName: o.store?.name ?? o.storeName ?? 'Unassigned store',
          latest,
          lowestTotalPriceCents: o.totalPriceCents,
        })
      }
      byProduct.set(key, entry)
    }

    return Response.json({ observations, byProduct: [...byProduct.values()] })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  itemName: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().max(80).optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  storeId: z.string().trim().optional().nullable(),
  quantity: z.number().positive().max(9999).default(1),
  unit: z.string().trim().min(1).max(20).default('pc'),
  packageSize: z.string().trim().max(60).optional().nullable(),
  totalPriceCents: z.number().int().min(1).max(100_000_000),
  source: z.enum(['USER_ENTERED', 'RECEIPT', 'RETAILER_AUTHORIZED', 'PARTNER_FEED', 'COMMUNITY']).default('USER_ENTERED'),
  notes: z.string().trim().max(300).optional().nullable(),
})

/** Record a price observation (always labelled with its source). */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)
    const data = await parseBody(req, createSchema)

    let storeName: string | null = null
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: id } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
      storeName = store.name
    }

    const unitPrice = computeUnitPriceCents(data.totalPriceCents, data.quantity, data.unit)

    const observation = await db.priceObservation.create({
      data: {
        householdId: id,
        itemName: data.itemName,
        nameBn: data.nameBn || null,
        productId: data.productId || null,
        storeId: data.storeId || null,
        storeName,
        quantity: data.quantity,
        unit: data.unit,
        packageSize: data.packageSize || null,
        totalPriceCents: data.totalPriceCents,
        unitPriceCents: unitPrice?.unitPriceCents ?? null,
        unitPriceBasis: unitPrice?.basis ?? null,
        source: data.source,
        observedById: user.id,
        notes: data.notes || null,
      },
      include: { store: { select: { id: true, name: true } }, observedBy: { select: { id: true, name: true, avatarColor: true } } },
    })

    logActivity(id, user.id, 'PRICE', `${user.name} saved a price for “${data.itemName}”${storeName ? ` at ${storeName}` : ''}.`)
    broadcastHousehold(id, 'activity:changed')
    return Response.json({ observation }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
