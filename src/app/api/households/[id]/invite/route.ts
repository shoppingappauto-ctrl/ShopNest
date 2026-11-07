import { db } from '@/lib/db'
import { generateInviteCode, jsonError, requireHouseholdManager, requireUser } from '@/lib/shopnest/auth'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

/** Regenerate (rotate) the household invite code — revokes old links. */
export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdManager(user.id, id)

    let inviteCode = generateInviteCode()
    for (let i = 0; i < 5; i++) {
      const clash = await db.household.findUnique({ where: { inviteCode } })
      if (!clash) break
      inviteCode = generateInviteCode()
    }

    const household = await db.household.update({ where: { id }, data: { inviteCode } })
    broadcastHousehold(id, 'household:changed')
    return Response.json({ inviteCode: household.inviteCode })
  } catch (error) {
    return jsonError(error)
  }
}
