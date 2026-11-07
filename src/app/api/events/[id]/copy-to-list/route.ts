import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

const copySchema = z.object({
  listId: z.string().trim().min(1),
})

/**
 * Copy event checklist items to a shopping list (Feature Nine).
 *
 * Duplicate prevention: each EventItem stores an explicit `shoppingItemId`
 * link after copying. Items already linked are skipped — re-running this
 * action is idempotent and never creates duplicate shopping items.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const event = await db.householdEvent.findUnique({ where: { id }, include: { items: true } })
    if (!event) throw new ApiError(404, 'Event not found.')
    await requireHouseholdAccess(user.id, event.householdId)

    const data = await parseBody(req, copySchema)
    const list = await db.shoppingList.findFirst({ where: { id: data.listId, householdId: event.householdId } })
    if (!list) throw new ApiError(404, 'List not found in this household.')

    const toCopy = event.items.filter((it) => !it.shoppingItemId)
    let copied = 0
    for (const it of toCopy) {
      const item = await db.shoppingItem.create({
        data: {
          listId: list.id,
          householdId: event.householdId,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          category: it.category,
          storeId: it.storeId,
          addedById: user.id,
        },
      })
      await db.eventItem.update({ where: { id: it.id }, data: { shoppingItemId: item.id } })
      copied++
    }

    if (copied > 0) {
      logActivity(event.householdId, user.id, 'EVENT', `${user.name} copied ${copied} item${copied === 1 ? '' : 's'} from “${event.name}” to ${list.name}.`)
    }
    broadcastHousehold(event.householdId, 'items:changed')
    broadcastHousehold(event.householdId, 'events:changed')
    broadcastHousehold(event.householdId, 'activity:changed')
    return Response.json({ copied, skipped: event.items.length - copied })
  } catch (error) {
    return jsonError(error)
  }
}
