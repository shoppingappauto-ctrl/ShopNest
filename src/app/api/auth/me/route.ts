import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/shopnest/auth'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return Response.json({ user: null, households: [] })

    const memberships = await db.householdMember.findMany({
      where: { userId: user.id },
      include: { household: { select: { id: true, name: true, plan: true, inviteCode: true } } },
      orderBy: { joinedAt: 'asc' },
    })

    const households = memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      plan: m.household.plan,
      inviteCode: m.household.inviteCode,
      role: m.role,
      joinedAt: m.joinedAt,
    }))

    return Response.json({ user, households })
  } catch (error) {
    return jsonError(error)
  }
}
