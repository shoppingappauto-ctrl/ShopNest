import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdManager, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string; memberId: string }> }

const patchSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id, memberId } = await params
    await requireHouseholdManager(user.id, id)

    const member = await db.householdMember.findUnique({ where: { id: memberId } })
    if (!member || member.householdId !== id) throw new ApiError(404, 'Member not found.')
    if (member.role === 'OWNER') throw new ApiError(403, 'The household owner’s role cannot be changed.')

    const { role } = await parseBody(req, patchSchema)
    const updated = await db.householdMember.update({ where: { id: memberId }, data: { role } })

    const target = await db.user.findUnique({ where: { id: member.userId } })
    logActivity(id, user.id, 'HOUSEHOLD', `${user.name} set ${target?.name ?? 'a member'} as ${role.toLowerCase()}.`)
    broadcastHousehold(id, 'household:changed')

    return Response.json({ member: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id, memberId } = await params
    const access = await requireHouseholdManager(user.id, id)

    const member = await db.householdMember.findUnique({ where: { id: memberId } })
    if (!member || member.householdId !== id) throw new ApiError(404, 'Member not found.')
    if (member.role === 'OWNER') throw new ApiError(403, 'The household owner cannot be removed.')
    if (member.userId === user.id && access.role === 'ADMIN') {
      throw new ApiError(403, 'Admins cannot remove themselves — use “Leave household”.')
    }

    await db.householdMember.delete({ where: { id: memberId } })
    const target = await db.user.findUnique({ where: { id: member.userId } })
    logActivity(id, user.id, 'HOUSEHOLD', `${user.name} removed ${target?.name ?? 'a member'} from the household.`)
    broadcastHousehold(id, 'household:changed')

    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
