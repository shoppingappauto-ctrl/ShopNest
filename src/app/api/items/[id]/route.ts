import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  quantity: z.number().positive().max(9999).optional(),
  unit: z.enum(UNITS).optional(),
  note: z.string().trim().max(300).optional().nullable(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  storeId: z.string().trim().optional().nullable(),
  status: z.enum(['PENDING', 'PURCHASED', 'UNAVAILABLE', 'SUBSTITUTED']).optional(),
  substitutedWith: z.string().trim().max(80).optional().nullable(),
  isRecurring: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params

    const item = await db.shoppingItem.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    const data = await parseBody(req, patchSchema)
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: item.householdId } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
    }

    const now = new Date()
    const patch: Record<string, unknown> = { ...data }
    if (data.storeId !== undefined) patch.storeId = data.storeId || null
    if (data.substitutedWith !== undefined) patch.substitutedWith = data.substitutedWith || null

    if (data.status === 'PURCHASED' && item.status !== 'PURCHASED') {
      patch.purchasedAt = now
      patch.purchasedById = user.id
    }
    if (data.status && data.status !== 'PURCHASED' && item.status === 'PURCHASED') {
      patch.purchasedAt = null
      patch.purchasedById = null
    }

    const updated = await db.shoppingItem.update({
      where: { id },
      data: patch,
      include: {
        addedBy: { select: { id: true, name: true, avatarColor: true } },
        purchasedBy: { select: { id: true, name: true, avatarColor: true } },
        store: { select: { id: true, name: true, category: true } },
      },
    })

    // update household catalog stats on purchase
    if (data.status === 'PURCHASED' && item.status !== 'PURCHASED' && item.favoriteProductId) {
      await db.householdProduct
        .update({
          where: { id: item.favoriteProductId },
          data: { lastPurchasedAt: now, timesPurchased: { increment: 1 } },
        })
        .catch(() => {})
    }

    // activity
    if (data.status === 'PURCHASED' && item.status !== 'PURCHASED') {
      logActivity(item.householdId, user.id, 'ITEM_PURCHASED', `${user.name} got “${updated.name}”.`)
    } else if (data.status === 'UNAVAILABLE' && item.status !== 'UNAVAILABLE') {
      logActivity(item.householdId, user.id, 'ITEM_STATUS', `${user.name} couldn't find “${updated.name}”.`)
    } else if (data.status === 'SUBSTITUTED' && item.status !== 'SUBSTITUTED') {
      logActivity(
        item.householdId,
        user.id,
        'ITEM_STATUS',
        `${user.name} substituted “${updated.name}”${updated.substitutedWith ? ` with “${updated.substitutedWith}”` : ''}.`
      )
    }

    broadcastHousehold(item.householdId, 'items:changed')
    if (data.status) broadcastHousehold(item.householdId, 'activity:changed')

    return Response.json({ item: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const item = await db.shoppingItem.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    await db.shoppingItem.delete({ where: { id } })
    logActivity(item.householdId, user.id, 'ITEM_REMOVED', `${user.name} removed “${item.name}”.`)
    broadcastHousehold(item.householdId, 'items:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
