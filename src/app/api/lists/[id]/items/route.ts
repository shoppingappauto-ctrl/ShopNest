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
  storeId: z.string().trim().optional().nullable(),
  favoriteProductId: z.string().trim().optional().nullable(),
  isRecurring: z.boolean().default(false),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params

    const list = await db.shoppingList.findUnique({ where: { id } })
    if (!list) throw new ApiError(404, 'List not found.')
    await requireHouseholdAccess(user.id, list.householdId)

    const data = await parseBody(req, createSchema)

    // validate store & favorite product belong to this household
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: list.householdId } })
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
        storeId: data.storeId || null,
        favoriteProductId: data.favoriteProductId || null,
        isRecurring: data.isRecurring,
        addedById: user.id,
      },
      include: {
        addedBy: { select: { id: true, name: true, avatarColor: true } },
        store: { select: { id: true, name: true, category: true } },
      },
    })

    // bump household catalog stats when re-added from the catalog
    if (data.favoriteProductId) {
      await db.householdProduct.update({
        where: { id: data.favoriteProductId },
        data: { timesPurchased: { increment: 0 } }, // purchased count increments on purchase
      }).catch(() => {})
    }

    logActivity(list.householdId, user.id, 'ITEM_ADDED', `${user.name} added “${item.name}” to ${list.name}.`)
    broadcastHousehold(list.householdId, 'items:changed')
    broadcastHousehold(list.householdId, 'activity:changed')

    return Response.json({ item }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
