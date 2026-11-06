import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

async function loadListWithAccess(listId: string, userId: string) {
  const list = await db.shoppingList.findUnique({
    where: { id: listId },
    include: {
      store: { select: { id: true, name: true, category: true } },
      items: {
        include: {
          store: { select: { id: true, name: true, category: true } },
          photos: { select: { id: true, dataUrl: true, createdAt: true, uploadedById: true } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarColor: true } } },
            orderBy: { createdAt: 'asc' },
          },
          addedBy: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
    },
  })
  if (!list) throw new ApiError(404, 'List not found.')
  await requireHouseholdAccess(userId, list.householdId)
  return list
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const list = await loadListWithAccess(id, user.id)
    return Response.json({ list })
  } catch (error) {
    return jsonError(error)
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().trim().max(8).optional(),
  storeId: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const list = await db.shoppingList.findUnique({ where: { id } })
    if (!list) throw new ApiError(404, 'List not found.')
    await requireHouseholdAccess(user.id, list.householdId)

    const data = await parseBody(req, patchSchema)
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: list.householdId } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
    }

    const updated = await db.shoppingList.update({
      where: { id },
      data: { ...data, storeId: data.storeId === undefined ? undefined : data.storeId || null },
    })

    broadcastHousehold(list.householdId, 'lists:changed')
    broadcastHousehold(list.householdId, 'items:changed')
    return Response.json({ list: updated })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const list = await db.shoppingList.findUnique({ where: { id } })
    if (!list) throw new ApiError(404, 'List not found.')
    await requireHouseholdAccess(user.id, list.householdId)

    await db.shoppingList.delete({ where: { id } })
    logActivity(list.householdId, user.id, 'LIST_DELETED', `${user.name} deleted list “${list.name}”.`)
    broadcastHousehold(list.householdId, 'lists:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
