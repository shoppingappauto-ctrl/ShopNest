import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

/** Get one shopping session (household-scoped). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const session = await db.shoppingSession.findUnique({
      where: { id },
      include: { store: { select: { id: true, name: true } }, list: { select: { id: true, name: true } } },
    })
    if (!session) throw new ApiError(404, 'Shopping session not found.')
    await requireHouseholdAccess(user.id, session.householdId)
    return Response.json({ session })
  } catch (error) {
    return jsonError(error)
  }
}

/**
 * Finish a shopping session: computes a summary of purchased / unavailable /
 * remaining items, saves the history snapshot, and leaves unfinished items
 * on the list (never deletes them).
 */
export async function PATCH(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const session = await db.shoppingSession.findUnique({ where: { id } })
    if (!session) throw new ApiError(404, 'Shopping session not found.')
    await requireHouseholdAccess(user.id, session.householdId)
    if (session.status === 'FINISHED') throw new ApiError(409, 'This session is already finished.')

    const where = {
      householdId: session.householdId,
      list: { status: { not: 'ARCHIVED' } },
      ...(session.listId ? { listId: session.listId } : {}),
      ...(session.storeId ? { storeId: session.storeId } : {}),
    }

    const [purchased, unavailable, remaining] = await Promise.all([
      db.shoppingItem.findMany({
        where: { ...where, status: 'PURCHASED', purchasedAt: { gte: session.startedAt } },
        include: { store: { select: { name: true } } },
      }),
      db.shoppingItem.findMany({
        where: { ...where, status: 'UNAVAILABLE' },
        include: { store: { select: { name: true } } },
      }),
      db.shoppingItem.findMany({ where: { ...where, status: 'PENDING' }, include: { store: { select: { name: true } } } }),
    ])

    const spentCents = purchased.reduce((sum, it) => sum + (it.actualPriceCents ?? it.estimatedPriceCents ?? 0), 0)

    const snapshot = {
      purchased: purchased.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity, unit: it.unit, priceCents: it.actualPriceCents ?? it.estimatedPriceCents ?? null })),
      unavailable: unavailable.map((it) => ({ id: it.id, name: it.name })),
      remaining: remaining.map((it) => ({ id: it.id, name: it.name })),
    }

    const updated = await db.shoppingSession.update({
      where: { id },
      data: {
        status: 'FINISHED',
        finishedAt: new Date(),
        purchasedCount: purchased.length,
        unavailableCount: unavailable.length,
        remainingCount: remaining.length,
        spentCents,
        snapshotJson: JSON.stringify(snapshot),
      },
    })

    broadcastHousehold(session.householdId, 'items:changed')
    return Response.json({ session: updated, summary: snapshot })
  } catch (error) {
    return jsonError(error)
  }
}
