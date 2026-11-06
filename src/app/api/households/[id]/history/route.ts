import { db } from '@/lib/db'
import { jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'

type Params = { params: Promise<{ id: string }> }

/** Shopping history: purchased items across the household, newest first. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const items = await db.shoppingItem.findMany({
      where: { householdId: id, status: 'PURCHASED' },
      include: {
        purchasedBy: { select: { id: true, name: true, avatarColor: true } },
        store: { select: { id: true, name: true, category: true } },
        list: { select: { id: true, name: true } },
      },
      orderBy: { purchasedAt: 'desc' },
      take: 150,
    })
    return Response.json({ items })
  } catch (error) {
    return jsonError(error)
  }
}
