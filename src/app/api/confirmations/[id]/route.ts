import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

const decideSchema = z.object({
  action: z.enum(['decide', 'cancel']),
  decision: z.enum(['APPROVED', 'REJECTED', 'SUBSTITUTE_SUGGESTED']).optional(),
  note: z.string().trim().max(300).optional().nullable(),
  substituteName: z.string().trim().max(80).optional().nullable(),
  /** optimistic concurrency: the version the decider last saw */
  version: z.number().int().min(1).optional(),
})

/**
 * Respond to a confirmation request.
 *
 * Conflict handling: the client sends the `version` it saw. If the request
 * was already decided (version moved on), the API returns 409 instead of
 * silently overwriting the family's earlier decision.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const request = await db.itemConfirmationRequest.findUnique({
      where: { id },
      include: { item: { select: { id: true, name: true } } },
    })
    if (!request) throw new ApiError(404, 'Confirmation request not found.')
    await requireHouseholdAccess(user.id, request.householdId)

    const data = await parseBody(req, decideSchema)

    if (data.action === 'cancel') {
      if (request.status !== 'PENDING') throw new ApiError(409, 'Only pending requests can be cancelled.')
      if (request.requestedById !== user.id) throw new ApiError(403, 'Only the shopper who asked can cancel this request.')
      const cancelled = await db.itemConfirmationRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })
      broadcastHousehold(request.householdId, 'items:changed')
      return Response.json({ request: cancelled })
    }

    if (!data.decision) throw new ApiError(400, 'A decision is required.')
    if (request.status !== 'PENDING') throw new ApiError(409, 'This request was already decided.')
    if (data.version !== undefined && data.version !== request.version) {
      throw new ApiError(409, 'This request was just updated by someone else. Please refresh.')
    }

    const updated = await db.itemConfirmationRequest.update({
      where: { id },
      data: {
        status: data.decision,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: data.note || null,
        substituteName: data.decision === 'SUBSTITUTE_SUGGESTED' ? data.substituteName || null : null,
        version: { increment: 1 },
      },
      include: {
        photo: { select: { id: true, dataUrl: true } },
        requestedBy: { select: { id: true, name: true, avatarColor: true } },
        decidedBy: { select: { id: true, name: true, avatarColor: true } },
      },
    })

    const verb =
      data.decision === 'APPROVED' ? 'approved' : data.decision === 'REJECTED' ? 'rejected' : 'suggested a substitute for'
    logActivity(
      request.householdId,
      user.id,
      'CONFIRMATION',
      `${user.name} ${verb} “${request.item.name}”${data.note || data.substituteName ? `: “${data.substituteName ?? data.note}”` : ''}.`
    )
    broadcastHousehold(request.householdId, 'items:changed')
    broadcastHousehold(request.householdId, 'activity:changed')

    return Response.json({ request: updated })
  } catch (error) {
    return jsonError(error)
  }
}
