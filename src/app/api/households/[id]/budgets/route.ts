import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

/**
 * Budgets for a household.
 *
 * Scopes:
 * - TRIP    → one budget for a specific shopping list
 * - WEEKLY  → repeating weekly budget (anchor: periodStart, recomputed client-side)
 * - MONTHLY → repeating monthly budget (anchor: periodStart)
 * - EVENT   → budget for a planned event
 *
 * GET returns budgets with the matching spend already computed:
 * - TRIP   → sum of actual prices (fallback estimates) of purchased items in that list
 * - EVENT  → same, for items linked to the event via EventItem.shoppingItemId
 * - WEEKLY → purchases in the 7 days ending today (rolling, anchored)
 * - MONTHLY→ purchases in the current calendar month
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const budgets = await db.shoppingBudget.findMany({
      where: { householdId: id },
      include: { list: { select: { id: true, name: true, emoji: true } }, event: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const withSpend = await Promise.all(
      budgets.map(async (b) => {
        let where
        if (b.scope === 'TRIP' && b.listId) {
          where = { householdId: id, status: 'PURCHASED', listId: b.listId }
        } else if (b.scope === 'EVENT' && b.eventId) {
          const links = await db.eventItem.findMany({ where: { eventId: b.eventId, shoppingItemId: { not: null } }, select: { shoppingItemId: true } })
          where = { householdId: id, status: 'PURCHASED', id: { in: links.map((l) => l.shoppingItemId!).filter(Boolean) } }
        } else if (b.scope === 'WEEKLY') {
          where = { householdId: id, status: 'PURCHASED', purchasedAt: { gte: b.periodStart && b.periodStart > weekStart ? b.periodStart : weekStart } }
        } else {
          where = { householdId: id, status: 'PURCHASED', purchasedAt: { gte: monthStart } }
        }
        const purchased = await db.shoppingItem.findMany({ where, select: { actualPriceCents: true, estimatedPriceCents: true } })
        const spendCents = purchased.reduce((s, it) => s + (it.actualPriceCents ?? it.estimatedPriceCents ?? 0), 0)
        return { ...b, spendCents }
      })
    )

    return Response.json({ budgets: withSpend })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  scope: z.enum(['TRIP', 'WEEKLY', 'MONTHLY', 'EVENT']),
  listId: z.string().trim().optional().nullable(),
  eventId: z.string().trim().optional().nullable(),
  amountCents: z.number().int().min(0).max(100_000_000),
  periodStart: z.string().datetime().optional().nullable(),
})

/** Create or replace the budget for a scope/target (one active budget per target). */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)
    const data = await parseBody(req, createSchema)

    if (data.scope === 'TRIP' && !data.listId) throw new ApiError(400, 'A list is required for a trip budget.')
    if (data.scope === 'EVENT' && !data.eventId) throw new ApiError(400, 'An event is required for an event budget.')

    // upsert-by-target: replace an existing budget for the same target
    const existing = await db.shoppingBudget.findFirst({
      where: {
        householdId: id,
        scope: data.scope,
        ...(data.scope === 'TRIP' ? { listId: data.listId } : {}),
        ...(data.scope === 'EVENT' ? { eventId: data.eventId } : {}),
        ...(data.scope === 'WEEKLY' || data.scope === 'MONTHLY' ? { scope: data.scope } : {}),
      },
    })

    const payload = {
      amountCents: data.amountCents,
      periodStart: data.periodStart ? new Date(data.periodStart) : null,
      createdById: user.id,
    }

    const budget = existing
      ? await db.shoppingBudget.update({ where: { id: existing.id }, data: payload })
      : await db.shoppingBudget.create({
          data: {
            householdId: id,
            scope: data.scope,
            listId: data.listId || null,
            eventId: data.eventId || null,
            ...payload,
          },
        })

    logActivity(id, user.id, 'BUDGET', `${user.name} set a ${data.scope.toLowerCase()} budget.`)
    broadcastHousehold(id, 'items:changed')
    return Response.json({ budget }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
