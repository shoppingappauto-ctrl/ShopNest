import { db } from '@/lib/db'
import { jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'

type Params = { params: Promise<{ id: string }> }

/** Household activity feed (in-app notifications). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const activities = await db.activity.findMany({
      where: { householdId: id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    return Response.json({ activities })
  } catch (error) {
    return jsonError(error)
  }
}
