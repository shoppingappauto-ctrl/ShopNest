import { db } from '@/lib/db'
import { jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

/** Convenience entry point used by the Shopping Mode "Ask Family" sheet (see confirmations schema in items/[id]/confirmations). */
export async function GET(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const status = new URL(req.url).searchParams.get('status')
    const requests = await db.itemConfirmationRequest.findMany({
      where: { householdId: id, ...(status ? { status } : {}) },
      include: {
        photo: { select: { id: true, dataUrl: true } },
        requestedBy: { select: { id: true, name: true, avatarColor: true } },
        decidedBy: { select: { id: true, name: true, avatarColor: true } },
        item: { select: { id: true, name: true, listId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return Response.json({ requests })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)
    const body = (await req.json().catch(() => ({}))) as { itemId?: string; note?: string }
    if (!body.itemId) return Response.json({ error: 'itemId is required.' }, { status: 400 })

    const item = await db.shoppingItem.findFirst({ where: { id: body.itemId, householdId: id } })
    if (!item) return Response.json({ error: 'Item not found in this household.' }, { status: 404 })

    const open = await db.itemConfirmationRequest.findFirst({ where: { itemId: item.id, status: 'PENDING' } })
    if (open) return Response.json({ error: 'This item already has a pending confirmation request.' }, { status: 409 })

    const request = await db.itemConfirmationRequest.create({
      data: { itemId: item.id, householdId: id, requestedById: user.id, note: body.note || null },
      include: {
        requestedBy: { select: { id: true, name: true, avatarColor: true } },
        item: { select: { id: true, name: true } },
      },
    })
    broadcastHousehold(id, 'items:changed')
    broadcastHousehold(id, 'activity:changed')
    return Response.json({ request }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
