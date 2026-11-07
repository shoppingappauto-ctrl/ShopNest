import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireHouseholdManager, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const household = await db.household.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarColor: true, isSuspended: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { lists: true, items: true, stores: true, products: true, events: true } },
      },
    })
    if (!household) throw new ApiError(404, 'Household not found.')

    return Response.json({ household })
  } catch (error) {
    return jsonError(error)
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdManager(user.id, id)

    const { name } = await parseBody(req, patchSchema)
    const household = await db.household.update({ where: { id }, data: { name } })

    logActivity(id, user.id, 'HOUSEHOLD', `${user.name} renamed the household to “${name}”.`)
    broadcastHousehold(id, 'household:changed')

    return Response.json({ household })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const access = await requireHouseholdAccess(user.id, id)
    if (access.role !== 'OWNER') {
      throw new ApiError(403, 'Only the household owner can delete the household.')
    }
    // notify members before deletion so their clients drop stale state
    broadcastHousehold(id, 'household:changed')
    await db.household.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
