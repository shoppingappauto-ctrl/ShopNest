import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { STORE_CATEGORIES } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  category: z.enum(STORE_CATEGORIES).optional(),
  address: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
  isFavorite: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const store = await db.store.findUnique({ where: { id } })
    if (!store) throw new ApiError(404, 'Store not found.')
    await requireHouseholdAccess(user.id, store.householdId)

    const data = await parseBody(req, patchSchema)
    const updated = await db.store.update({ where: { id }, data })
    broadcastHousehold(store.householdId, 'stores:changed')
    return Response.json({ store: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const store = await db.store.findUnique({ where: { id } })
    if (!store) throw new ApiError(404, 'Store not found.')
    await requireHouseholdAccess(user.id, store.householdId)

    await db.store.delete({ where: { id } })
    broadcastHousehold(store.householdId, 'stores:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
