import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ pantryId: string; id: string }> }

const patchSchema = z.object({
  quantity: z.number().positive().max(9999).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  status: z.enum(['IN_STOCK', 'RUNNING_LOW', 'OUT_OF_STOCK', 'UNKNOWN']).optional(),
  notes: z.string().trim().max(300).optional().nullable(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { pantryId, id } = await params
    await requireHouseholdAccess(user.id, id)
    const item = await db.pantryItem.findFirst({ where: { id: pantryId, householdId: id } })
    if (!item) throw new ApiError(404, 'Pantry item not found.')
    const data = await parseBody(req, patchSchema)

    const updated = await db.pantryItem.update({
      where: { id: pantryId },
      data: {
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.unit !== undefined ? { unit: data.unit || null } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        updatedById: user.id,
      },
      include: { householdProduct: { select: { id: true, name: true } } },
    })
    broadcastHousehold(id, 'activity:changed')
    return Response.json({ item: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { pantryId, id } = await params
    await requireHouseholdAccess(user.id, id)
    const item = await db.pantryItem.findFirst({ where: { id: pantryId, householdId: id } })
    if (!item) throw new ApiError(404, 'Pantry item not found.')
    await db.pantryItem.delete({ where: { id: pantryId } })
    broadcastHousehold(id, 'activity:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
