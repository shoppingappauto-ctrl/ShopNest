import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ budgetId: string; id: string }> }

const patchSchema = z.object({
  amountCents: z.number().int().min(0).max(100_000_000),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { budgetId, id } = await params
    await requireHouseholdAccess(user.id, id)
    const budget = await db.shoppingBudget.findFirst({ where: { id: budgetId, householdId: id } })
    if (!budget) throw new ApiError(404, 'Budget not found.')
    const data = await parseBody(req, patchSchema)
    const updated = await db.shoppingBudget.update({ where: { id: budgetId }, data: { amountCents: data.amountCents } })
    broadcastHousehold(id, 'items:changed')
    return Response.json({ budget: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { budgetId, id } = await params
    await requireHouseholdAccess(user.id, id)
    const budget = await db.shoppingBudget.findFirst({ where: { id: budgetId, householdId: id } })
    if (!budget) throw new ApiError(404, 'Budget not found.')
    await db.shoppingBudget.delete({ where: { id: budgetId } })
    broadcastHousehold(id, 'items:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
