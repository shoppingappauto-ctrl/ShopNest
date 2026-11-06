import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { COMMENT_KINDS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

const createSchema = z.object({
  kind: z.enum(COMMENT_KINDS).default('COMMENT'),
  text: z.string().trim().min(1, 'Write a message.').max(500),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params

    const item = await db.shoppingItem.findUnique({
      where: { id },
      include: { list: { select: { name: true } } },
    })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    const data = await parseBody(req, createSchema)

    const comment = await db.itemComment.create({
      data: { itemId: item.id, userId: user.id, kind: data.kind, text: data.text },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    })

    // a question with a photo triggers confirmation flow; approvals resolve it
    if (data.kind === 'COMMENT') {
      logActivity(item.householdId, user.id, 'COMMENT', `${user.name} commented on “${item.name}”.`)
    } else if (data.kind === 'APPROVE') {
      logActivity(item.householdId, user.id, 'COMMENT', `${user.name} approved “${item.name}”. ✓`)
    } else if (data.kind === 'REJECT') {
      logActivity(item.householdId, user.id, 'COMMENT', `${user.name} rejected “${item.name}”. ✗`)
    } else if (data.kind === 'SUBSTITUTE') {
      logActivity(item.householdId, user.id, 'COMMENT', `${user.name} suggested an alternative for “${item.name}”.`)
    }

    broadcastHousehold(item.householdId, 'items:changed')
    broadcastHousehold(item.householdId, 'activity:changed')

    return Response.json({ comment }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
