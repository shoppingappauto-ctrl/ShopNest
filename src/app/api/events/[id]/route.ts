import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { EVENT_TYPES } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  date: z.string().optional().nullable(),
  guestCount: z.number().int().positive().max(2000).optional().nullable(),
  budget: z.number().positive().max(1_000_000).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['PLANNING', 'COMPLETED']).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const event = await db.householdEvent.findUnique({ where: { id } })
    if (!event) throw new ApiError(404, 'Event not found.')
    await requireHouseholdAccess(user.id, event.householdId)

    const data = await parseBody(req, patchSchema)
    const updated = await db.householdEvent.update({
      where: { id },
      data: {
        ...data,
        date: data.date === undefined ? undefined : data.date ? new Date(data.date) : null,
        guestCount: data.guestCount === undefined ? undefined : data.guestCount,
        budget: data.budget === undefined ? undefined : data.budget,
        notes: data.notes === undefined ? undefined : data.notes || null,
      },
    })
    broadcastHousehold(event.householdId, 'events:changed')
    return Response.json({ event: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const event = await db.householdEvent.findUnique({ where: { id } })
    if (!event) throw new ApiError(404, 'Event not found.')
    await requireHouseholdAccess(user.id, event.householdId)

    await db.householdEvent.delete({ where: { id } })
    broadcastHousehold(event.householdId, 'events:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
