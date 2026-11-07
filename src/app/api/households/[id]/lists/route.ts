import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError, requireUser, requireHouseholdAccess, ApiError } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const lists = await db.shoppingList.findMany({
      where: { householdId: id, status: { not: 'ARCHIVED' } },
      include: {
        store: { select: { id: true, name: true, category: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // compute counts in one go
    const counts = await db.shoppingItem.groupBy({
      by: ['listId', 'status'],
      where: { householdId: id },
      _count: true,
    })

    const listsWithCounts = lists.map((l) => {
      const mine = counts.filter((c) => c.listId === l.id)
      const pending = mine.find((c) => c.status === 'PENDING')?._count ?? 0
      const purchased = mine.find((c) => c.status === 'PURCHASED')?._count ?? 0
      const unavailable = mine.find((c) => c.status === 'UNAVAILABLE')?._count ?? 0
      const total = mine.reduce((acc, c) => acc + c._count, 0)
      return {
        ...l,
        counts: { total, pending, purchased, unavailable },
      }
    })

    return Response.json({ lists: listsWithCounts })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'List name is required.').max(60),
  emoji: z.string().trim().max(8).default('🛒'),
  storeId: z.string().trim().optional().nullable(),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const data = await parseBody(req, createSchema)
    if (data.storeId) {
      const store = await db.store.findFirst({ where: { id: data.storeId, householdId: id } })
      if (!store) throw new ApiError(404, 'Store not found in this household.')
    }

    const list = await db.shoppingList.create({
      data: {
        householdId: id,
        name: data.name,
        emoji: data.emoji || '🛒',
        storeId: data.storeId || null,
        createdById: user.id,
      },
      include: { store: { select: { id: true, name: true, category: true } } },
    })

    logActivity(id, user.id, 'LIST_CREATED', `${user.name} created list “${list.name}”.`)
    broadcastHousehold(id, 'lists:changed')

    return Response.json({ list: { ...list, counts: { total: 0, pending: 0, purchased: 0, unavailable: 0 } } }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
