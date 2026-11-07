import { db } from '@/lib/db'
import { jsonError, requireUser, requireHouseholdAccess, ApiError } from '@/lib/shopnest/auth'

type Params = { params: Promise<{ id: string }> }

/**
 * Upgrade to ShopNest Plus ($3.99/month per household).
 *
 * IMPORTANT: Native in-app billing (Apple/Google) and Stripe are intentionally
 * NOT activated in this build. Subscriptions require explicit owner approval
 * before any real payment is taken, per the project guidelines.
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const household = await db.household.findUnique({ where: { id } })
    if (!household) throw new ApiError(404, 'Household not found.')
    if (household.plan === 'PLUS') {
      return Response.json({ ok: true, plan: 'PLUS', activated: true })
    }

    return Response.json(
      {
        ok: false,
        plan: 'FREE',
        paymentsEnabled: false,
        message:
          'ShopNest Plus is $3.99/month per household. Payments are not enabled in this build — billing is activated after app-store and Stripe credentials are configured and approved.',
      },
      { status: 402 }
    )
  } catch (error) {
    return jsonError(error)
  }
}
