import { db } from '@/lib/db'
import { ApiError, destroySession, jsonError, requireUser } from '@/lib/shopnest/auth'
import { broadcastHousehold } from '@/lib/shopnest/notify'

/**
 * Permanent account deletion (right-to-erasure).
 *
 * Data-preservation rules (no shared household data is lost):
 *  • If the user is the OWNER of a household that still has other members,
 *    deletion is REFUSED (403) — they must promote a successor first
 *    (mirrors the /leave household guard).
 *  • If the user is the OWNER and the SOLE member, that household is deleted
 *    outright (no shared data exists to lose).
 *  • For households where the user is a non-owner member, the shopping items
 *    they added are REASSIGNED to the household OWNER before the user is
 *    deleted, so the household's shared list data is preserved.
 *
 * The User row is then deleted. Prisma cascade handles: Session, remaining
 * HouseholdMember rows, ItemComment, Activity, requested ItemConfirmationRequest,
 * PriceObservation. Nullable relations (ShoppingItem.purchasedBy /
 * ItemConfirmationRequest.decidedBy / EventItem.assignedTo) are SetNull.
 */
export async function DELETE() {
  try {
    const user = await requireUser()

    const memberships = await db.householdMember.findMany({
      where: { userId: user.id },
      include: {
        household: {
          select: {
            id: true,
            name: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    })

    // Guard: an OWNER of a household with other members must promote a successor first.
    for (const m of memberships) {
      if (m.role === 'OWNER') {
        const others = m.household.members.filter((x) => x.userId !== user.id)
        if (others.length > 0) {
          throw new ApiError(
            403,
            `Promote another member to owner of "${m.household.name}" before deleting your account.`
          )
        }
      }
    }

    const survivingHouseholdIds = memberships
      .filter((m) => m.role !== 'OWNER')
      .map((m) => m.householdId)

    await db.$transaction(async (tx) => {
      // 1. Reassign items the user added in surviving households to the household
      //    OWNER so shared shopping data is NOT cascade-deleted with the user.
      for (const m of memberships) {
        if (m.role === 'OWNER') continue // sole-owner households are deleted below
        const owner = m.household.members.find((x) => x.role === 'OWNER')
        if (!owner || owner.userId === user.id) continue
        await tx.shoppingItem.updateMany({
          where: { householdId: m.householdId, addedById: user.id },
          data: { addedById: owner.userId },
        })
      }

      // 2. Delete sole-owner households (user is alone → no shared data loss).
      for (const m of memberships) {
        if (m.role === 'OWNER') {
          await tx.household.delete({ where: { id: m.householdId } })
        }
      }

      // 3. Delete the user. Cascade removes sessions, remaining memberships,
      //    comments, activities, requested confirmations, price observations.
      //    Nullable relations (purchasedBy/decidedBy/assignedTo) are SetNull.
      await tx.user.delete({ where: { id: user.id } })
    })

    // Notify surviving households that membership changed.
    for (const id of survivingHouseholdIds) broadcastHousehold(id, 'household:changed')

    // Clear the session cookie / token (the session row is already cascade-deleted).
    await destroySession()
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
