import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

const zod = await import('zod')
const dupSchema = zod.object({
  name: zod.string().trim().min(1).max(80).optional(),
  date: zod.string().datetime().optional().nullable(),
  asTemplate: zod.boolean().default(false),
})

/**
 * Duplicate an event (Feature Nine): copies name/type/guests/budget/notes and
 * all checklist items (including store assignments and assignees). Used both
 * for "duplicate event" and "save as reusable template".
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const event = await db.householdEvent.findUnique({ where: { id }, include: { items: true } })
    if (!event) throw new ApiError(404, 'Event not found.')
    await requireHouseholdAccess(user.id, event.householdId)

    const body = await req.json().catch(() => ({}))
    const data = dupSchema.parse(body)

    const copy = await db.householdEvent.create({
      data: {
        householdId: event.householdId,
        name: data.name ?? (data.asTemplate ? `${event.name} (template)` : `${event.name} (copy)`),
        type: event.type,
        date: data.date !== undefined ? (data.date ? new Date(data.date) : null) : event.date,
        guestCount: event.guestCount,
        budget: event.budget,
        notes: event.notes,
        isTemplate: data.asTemplate,
        status: data.asTemplate ? 'PLANNING' : 'PLANNING',
        items: {
          create: event.items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            category: it.category,
            storeId: it.storeId,
            assignedToId: it.assignedToId,
            createdById: user.id,
            // shoppingItemId is intentionally NOT copied — links are per-event
          })),
        },
      },
      include: { items: true },
    })

    logActivity(event.householdId, user.id, 'EVENT', `${user.name} ${data.asTemplate ? 'saved a template from' : 'duplicated'} “${event.name}”.`)
    broadcastHousehold(event.householdId, 'events:changed')
    broadcastHousehold(event.householdId, 'activity:changed')
    return Response.json({ event: copy }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
