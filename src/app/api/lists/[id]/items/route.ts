import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const createSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required.').max(80),
  nameBn: z.string().trim().max(80).optional().nullable(),
  quantity: z.number().positive().max(9999).default(1),
  unit: z.enum(UNITS).default('pc'),
  note: z.string().trim().max(300).optional().nullable(),
  category: z.enum(ITEM_CATEGORIES).default('OTHER'),
  // storeId semantics: omitted/undefined → inherit the list's default store;
  // null → explicitly unassigned; string → that store
  storeId: z.string().trim().optional().nullable(),
  favoriteProductId: z.string().trim().optional().nullable(),
  isRecurring: z.boolean().default(false),
  estimatedPriceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params

    const list = await db.shoppingList.findUnique({ where: { id } })
    if (!list) throw new ApiError(404, 'List not found.')
    await requireHouseholdAccess(user.id, list.householdId)

    const data = await parseBody(req, createSchema)

    // canonical store assignment: explicit store wins, otherwise inherit the
    // list's default store as a *default* for the new item (per-item override
    // remains fully editable afterwards)
    const resolvedStoreId = data.storeId !== undefined ? data.storeId || null : list.storeId || null
    if (resolvedStoreId) {
      const store = await db.store.findFirst({ where: { id: resolvedStoreId, householdId: list.householdId } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
    }
    if (data.favoriteProductId) {
      const product = await db.householdProduct.findFirst({
        where: { id: data.favoriteProductId, householdId: list.householdId },
      })
      if (!product) throw new ApiError(404, 'Favorite product not found.')
    }

    const item = await db.shoppingItem.create({
      data: {
        listId: list.id,
        householdId: list.householdId,
        name: data.name,
        nameBn: data.nameBn || null,
        quantity: data.quantity,
        unit: data.unit,
        note: data.note || null,
        category: data.category,
        storeId: resolvedStoreId,
        favoriteProductId: data.favoriteProductId || null,
        isRecurring: data.isRecurring,
        estimatedPriceCents: data.estimatedPriceCents ?? null,
        addedById: user.id,
      },
      include: {
        addedBy: { select: { id: true, name: true, avatarColor: true } },
        store: { select: { id: true, name: true, category: true } },
      },
    })

    // bump household catalog stats when re-added from the catalog
    // (timesPurchased increments on purchase — nothing to do at add time)

    logActivity(list.householdId, user.id, 'ITEM_ADDED', `${user.name} added “${item.name}” to ${list.name}.`)
    broadcastHousehold(list.householdId, 'items:changed')
    broadcastHousehold(list.householdId, 'stores:changed')
    broadcastHousehold(list.householdId, 'activity:changed')

    return Response.json({ item }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
