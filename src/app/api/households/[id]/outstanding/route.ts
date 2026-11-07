import { db } from '@/lib/db'
import { jsonError, requireUser, requireHouseholdAccess } from '@/lib/shopnest/auth'

type Params = { params: Promise<{ id: string }> }

/**
 * All outstanding (pending) items across the household, grouped by store.
 *
 * CANONICAL STORE ATTRIBUTION (V2):
 * An item belongs to the store on ITS OWN `storeId`. The list's default
 * store is a convenience for new items only and is NEVER used to group,
 * count or filter existing items. Items without a store are grouped under
 * `Unassigned` (storeId "none"). This single rule is shared by the stores
 * page counts, store detail and Shopping Mode so all numbers always agree.
 *
 * Items in ARCHIVED lists are excluded from outstanding counts everywhere.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const items = await db.shoppingItem.findMany({
      where: {
        householdId: id,
        status: 'PENDING',
        list: { status: { not: 'ARCHIVED' } },
      },
      include: {
        store: { select: { id: true, name: true, category: true } },
        list: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    type GroupItem = {
      id: string
      name: string
      nameBn: string | null
      quantity: number
      unit: string
      note: string | null
      category: string
      listId: string
      listName: string
      estimatedPriceCents: number | null
    }
    const groups = new Map<string, { storeId: string; storeName: string; category: string; items: GroupItem[] }>()

    for (const item of items) {
      // canonical: only the item's own store
      const storeId = item.store?.id ?? 'none'
      const storeName = item.store?.name ?? 'Unassigned'
      const category = item.store?.category ?? 'OTHER'
      const g = groups.get(storeId) ?? { storeId, storeName, category, items: [] }
      g.items.push({
        id: item.id,
        name: item.name,
        nameBn: item.nameBn,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        category: item.category,
        listId: item.list?.id ?? '',
        listName: item.list?.name ?? '',
        estimatedPriceCents: item.estimatedPriceCents,
      })
      groups.set(storeId, g)
    }

    return Response.json({ groups: [...groups.values()] })
  } catch (error) {
    return jsonError(error)
  }
}
