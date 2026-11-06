import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const access = await requireHouseholdAccess(user.id, id)

    if (access.role === 'OWNER') {
      const ownerCount = await db.householdMember.count({
        where: { householdId: id, role: 'OWNER' },
      })
      if (ownerCount <= 1) {
        const otherCount = await db.householdMember.count({ where: { householdId: id } })
        if (otherCount > 1) {
          throw new ApiError(403, 'Promote another member to owner before leaving.')
        }
      }
    }

    await db.householdMember.delete({
      where: { householdId_userId: { householdId: id, userId: user.id } },
    })

    logActivity(id, user.id, 'HOUSEHOLD', `${user.name} left the household.`)
    broadcastHousehold(id, 'household:changed')

    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
