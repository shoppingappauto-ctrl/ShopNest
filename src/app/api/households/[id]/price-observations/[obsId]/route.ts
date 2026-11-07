import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'

type Params = { params: Promise<{ obsId: string; id: string }> }

/** Delete/correct a price observation (household-scoped; corrections are delete + re-enter). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { obsId, id } = await params
    await requireHouseholdAccess(user.id, id)
    const obs = await db.priceObservation.findFirst({ where: { id: obsId, householdId: id } })
    if (!obs) throw new ApiError(404, 'Price observation not found.')
    await db.priceObservation.delete({ where: { id: obsId } })
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
