import { db } from '@/lib/db'
import { jsonError, requireUser, requireHouseholdAccess } from '@/lib/shopnest/auth'

type Params = { params: Promise<{ id: string }> }

/** All outstanding (pending) items across the household, grouped by store. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const items = await db.shoppingItem.findMany({
      where: { householdId: id, status: 'PENDING' },
      include: {
        store: { select: { id: true, name: true, category: true } },
        list: { select: { id: true, name: true, store: { select: { id: true, name: true, category: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const groups = new Map<
      string,
      { storeId: string; storeName: string; category: string; items: { id: string; name: string; quantity: number; unit: string; listName: string }[] }
    >()

    for (const item of items) {
      const storeId = item.store?.id ?? item.list?.store?.id ?? 'none'
      const storeName = item.store?.name ?? item.list?.store?.name ?? 'No store'
      const category = item.store?.category ?? item.list?.store?.category ?? 'OTHER'
      const g = groups.get(storeId) ?? { storeId, storeName, category, items: [] }
      g.items.push({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit, listName: item.list?.name ?? '' })
      groups.set(storeId, g)
    }

    return Response.json({ groups: [...groups.values()] })
  } catch (error) {
    return jsonError(error)
  }
}
