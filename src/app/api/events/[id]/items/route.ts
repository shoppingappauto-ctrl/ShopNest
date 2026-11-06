import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const createSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required.').max(80),
  quantity: z.number().positive().max(9999).default(1),
  unit: z.enum(UNITS).default('pc'),
  category: z.enum(ITEM_CATEGORIES).default('OTHER'),
  storeId: z.string().trim().optional().nullable(),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params

    const event = await db.householdEvent.findUnique({ where: { id } })
    if (!event) throw new ApiError(404, 'Event not found.')
    await requireHouseholdAccess(user.id, event.householdId)

    const data = await parseBody(req, createSchema)
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: event.householdId } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
    }

    const item = await db.eventItem.create({
      data: {
        eventId: event.id,
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category,
        storeId: data.storeId || null,
        createdById: user.id,
      },
    })

    broadcastHousehold(event.householdId, 'events:changed')
    return Response.json({ item }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
