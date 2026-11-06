import { z } from 'zod'
import { db } from '@/lib/db'
import { generateInviteCode, jsonError, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Household name must be at least 2 characters.').max(60),
})

export async function GET() {
  try {
    const user = await requireUser()
    const memberships = await db.householdMember.findMany({
      where: { userId: user.id },
      include: { household: { select: { id: true, name: true, plan: true, inviteCode: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    return Response.json({
      households: memberships.map((m) => ({
        id: m.household.id,
        name: m.household.name,
        plan: m.household.plan,
        inviteCode: m.household.inviteCode,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { name } = await parseBody(req, createSchema)

    let inviteCode = generateInviteCode()
    // guarantee uniqueness
    for (let i = 0; i < 5; i++) {
      const clash = await db.household.findUnique({ where: { inviteCode } })
      if (!clash) break
      inviteCode = generateInviteCode()
    }

    const household = await db.household.create({
      data: {
        name,
        inviteCode,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    })

    logActivity(household.id, user.id, 'HOUSEHOLD', `${user.name} created the household “${name}”.`)
    broadcastHousehold(household.id, 'household:changed')

    return Response.json({ household }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
