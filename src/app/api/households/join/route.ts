import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError, requireUser, ApiError } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

const joinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^SN-[A-Z0-9]{6}$/, 'Invite codes look like SN-7K2QP4.'),
})

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { inviteCode } = await parseBody(req, joinSchema)

    const household = await db.household.findUnique({ where: { inviteCode } })
    if (!household) throw new ApiError(404, 'That invite code is not valid. Check with your household owner.')

    const existing = await db.householdMember.findUnique({
      where: { householdId_userId: { householdId: household.id, userId: user.id } },
    })
    if (existing) throw new ApiError(409, 'You are already a member of this household.')

    const memberCount = await db.householdMember.count({ where: { householdId: household.id } })
    if (memberCount >= 20) throw new ApiError(403, 'This household is full.')

    await db.householdMember.create({
      data: { householdId: household.id, userId: user.id, role: 'MEMBER' },
    })

    logActivity(household.id, user.id, 'MEMBER_JOINED', `${user.name} joined the household.`)
    broadcastHousehold(household.id, 'household:changed')

    return Response.json({ household: { id: household.id, name: household.name } })
  } catch (error) {
    return jsonError(error)
  }
}
