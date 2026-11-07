import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

/** Recent shopping sessions (Finish Shopping history) for a household. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const sessions = await db.shoppingSession.findMany({
      where: { householdId: id },
      include: { store: { select: { id: true, name: true } }, list: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 30,
    })
    return Response.json({ sessions })
  } catch (error) {
    return jsonError(error)
  }
}

const startSchema = z.object({
  listId: z.string().trim().optional().nullable(),
  storeId: z.string().trim().optional().nullable(),
})

/** Start a Shopping Mode session. */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)
    const data = await parseBody(req, startSchema)

    if (data.listId) {
      const list = await db.shoppingList.findFirst({ where: { id: data.listId, householdId: id } })
      if (!list) throw new ApiError(404, 'List not found in this household.')
    }
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: id } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
    }

    // close any stale ACTIVE sessions for this household (defensive; the UI
    // finishes sessions explicitly, but an abandoned session shouldn't linger)
    await db.shoppingSession.updateMany({
      where: { householdId: id, status: 'ACTIVE' },
      data: { status: 'FINISHED', finishedAt: new Date() },
    })

    const session = await db.shoppingSession.create({
      data: {
        householdId: id,
        listId: data.listId || null,
        storeId: data.storeId || null,
        startedById: user.id,
      },
      include: { store: { select: { id: true, name: true } }, list: { select: { id: true, name: true } } },
    })
    return Response.json({ session }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
