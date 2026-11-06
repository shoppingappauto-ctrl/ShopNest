import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  nameBn: z.string().trim().max(80).optional().nullable(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  defaultQty: z.number().positive().max(9999).optional(),
  unit: z.enum(UNITS).optional(),
  storeId: z.string().trim().optional().nullable(),
  isFavorite: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceDays: z.number().int().positive().max(365).optional().nullable(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const product = await db.householdProduct.findUnique({ where: { id } })
    if (!product) throw new ApiError(404, 'Product not found.')
    await requireHouseholdAccess(user.id, product.householdId)

    const data = await parseBody(req, patchSchema)
    const updated = await db.householdProduct.update({
      where: { id },
      data: {
        ...data,
        nameBn: data.nameBn === undefined ? undefined : data.nameBn || null,
        storeId: data.storeId === undefined ? undefined : data.storeId || null,
        recurrenceDays: data.recurrenceDays === undefined ? undefined : data.recurrenceDays || null,
      },
    })
    broadcastHousehold(product.householdId, 'products:changed')
    return Response.json({ product: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const product = await db.householdProduct.findUnique({ where: { id } })
    if (!product) throw new ApiError(404, 'Product not found.')
    await requireHouseholdAccess(user.id, product.householdId)

    await db.householdProduct.delete({ where: { id } })
    broadcastHousehold(product.householdId, 'products:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
