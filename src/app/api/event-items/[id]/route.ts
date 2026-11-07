import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  quantity: z.number().positive().max(9999).optional(),
  unit: z.enum(UNITS).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  isDone: z.boolean().optional(),
  storeId: z.string().trim().optional().nullable(),
  assignedToId: z.string().trim().optional().nullable(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const item = await db.eventItem.findUnique({
      where: { id },
      include: { event: { select: { householdId: true } } },
    })
    if (!item) throw new ApiError(404, 'Event item not found.')
    await requireHouseholdAccess(user.id, item.event.householdId)

    const data = await parseBody(req, patchSchema)
    if (data.assignedToId) {
      const member = await db.householdMember.findFirst({
        where: { userId: data.assignedToId, householdId: item.event.householdId },
      })
      if (!member) throw new ApiError(404, 'Assignee must be a member of this household.')
    }
    const patch: Record<string, unknown> = { ...data }
    if (data.storeId !== undefined) patch.storeId = data.storeId || null
    if (data.assignedToId !== undefined) patch.assignedToId = data.assignedToId || null
    const updated = await db.eventItem.update({ where: { id }, data: patch })
    broadcastHousehold(item.event.householdId, 'events:changed')
    return Response.json({ item: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const item = await db.eventItem.findUnique({
      where: { id },
      include: { event: { select: { householdId: true } } },
    })
    if (!item) throw new ApiError(404, 'Event item not found.')
    await requireHouseholdAccess(user.id, item.event.householdId)

    await db.eventItem.delete({ where: { id } })
    broadcastHousehold(item.event.householdId, 'events:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
