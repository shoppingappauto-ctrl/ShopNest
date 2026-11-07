import { db } from '@/lib/db'
import { jsonError, requireUser, ApiError } from '@/lib/shopnest/auth'
import { PLUS_PRICE_PER_MONTH } from '@/lib/shopnest/constants'

/**
 * Admin dashboard metrics — all computed from real database data.
 * Metrics that cannot be measured in this build (e.g. native subscription
 * revenue, since payments are disabled) are reported honestly as unavailable.
 */
export async function GET() {
  try {
    const user = await requireUser()
    if (!user.isAdmin) throw new ApiError(403, 'Admin access required.')

    const [totalUsers, totalHouseholds, totalLists, totalItems, purchasedItems, plusHouseholds, suspendedUsers, photos] =
      await Promise.all([
        db.user.count(),
        db.household.count(),
        db.shoppingList.count(),
        db.shoppingItem.count(),
        db.shoppingItem.count({ where: { status: 'PURCHASED' } }),
        db.household.count({ where: { plan: 'PLUS' } }),
        db.user.count({ where: { isSuspended: true } }),
        db.itemPhoto.count(),
      ])

    const now = Date.now()
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const newUsersWeek = await db.user.count({ where: { createdAt: { gte: weekAgo } } })

    const [dau, wau, mau] = await Promise.all([
      db.user.count({ where: { lastActiveAt: { gte: dayAgo } } }),
      db.user.count({ where: { lastActiveAt: { gte: weekAgo } } }),
      db.user.count({ where: { lastActiveAt: { gte: monthAgo } } }),
    ])

    // photo storage estimate (approximate bytes from dataUrl lengths)
    const photoRows = await db.itemPhoto.findMany({ select: { dataUrl: true } })
    const storageBytes = photoRows.reduce((acc, p) => acc + p.dataUrl.length * 0.75, 0)

    const mrr = plusHouseholds * PLUS_PRICE_PER_MONTH

    // ── V2 feature metrics (all from real data; never fabricated) ──────────
    const [shoppingSessionsStarted, shoppingSessionsCompleted, confirmationRequests, confirmationsDecided, budgets, priceObservations, pantryItems, events, templates, caregiverMembers] =
      await Promise.all([
        db.shoppingSession.count(),
        db.shoppingSession.count({ where: { status: 'FINISHED' } }),
        db.itemConfirmationRequest.count(),
        db.itemConfirmationRequest.count({ where: { status: { in: ['APPROVED', 'REJECTED', 'SUBSTITUTE_SUGGESTED'] } } }),
        db.shoppingBudget.count(),
        db.priceObservation.count(),
        db.pantryItem.count(),
        db.householdEvent.count(),
        db.householdEvent.count({ where: { isTemplate: true } }),
        db.householdMember.count({ where: { role: 'CAREGIVER' } }),
      ])
    // average confirmation response time (decided requests only)
    const decided = await db.itemConfirmationRequest.findMany({
      where: { decidedAt: { not: null } },
      select: { createdAt: true, decidedAt: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    })
    const avgConfirmationMinutes =
      decided.length > 0
        ? Math.round(decided.reduce((s, r) => s + (r.decidedAt!.getTime() - r.createdAt.getTime()), 0) / decided.length / 60000)
        : null
    // quality signals
    const pendingConfirmations = await db.itemConfirmationRequest.count({ where: { status: 'PENDING' } })

    return Response.json({
      users: { total: totalUsers, suspended: suspendedUsers, newThisWeek: newUsersWeek },
      households: { total: totalHouseholds, plus: plusHouseholds, free: totalHouseholds - plusHouseholds },
      engagement: { dau, wau, mau },
      shopping: { lists: totalLists, items: totalItems, purchasedItems },
      billing: {
        paymentsEnabled: false,
        mrr,
        payingHouseholds: plusHouseholds,
        note: 'Payments are disabled in this build; MRR reflects plan flags only.',
      },
      storage: { photos, bytes: storageBytes },
      v2: {
        shoppingSessionsStarted,
        shoppingSessionsCompleted,
        confirmationRequests,
        confirmationsDecided,
        pendingConfirmations,
        avgConfirmationMinutes,
        budgets,
        priceObservations,
        pantryItems,
        events,
        eventTemplates: templates,
        caregiverMembers,
        note: 'Voice-add and photo-upload error metrics require client telemetry, not yet implemented in this build.',
      },
      meta: { generatedAt: new Date().toISOString() },
    })
  } catch (error) {
    return jsonError(error)
  }
}
