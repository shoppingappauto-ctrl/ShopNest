import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { STORE_CATEGORIES } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const stores = await db.store.findMany({
      where: { householdId: id },
      include: {
        // canonical outstanding count: only items explicitly assigned to this
        // store, pending, and not in archived lists — matches the outstanding
        // API and Shopping Mode exactly
        _count: {
          select: {
            items: { where: { status: 'PENDING', list: { status: { not: 'ARCHIVED' } } } },
            lists: true,
          },
        },
      },
      orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
    })
    return Response.json({ stores })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Store name is required.').max(60),
  category: z.enum(STORE_CATEGORIES).default('SUPERMARKET'),
  address: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
  isFavorite: z.boolean().default(false),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const data = await parseBody(req, createSchema)

    // case-insensitive duplicate check (SQLite has no insensitive mode)
    const existingStores = await db.store.findMany({ where: { householdId: id }, select: { id: true, name: true } })
    const duplicate = existingStores.find((s) => s.name.trim().toLowerCase() === data.name.trim().toLowerCase())
    if (duplicate) throw new ApiError(409, 'A store with this name already exists.')

    const store = await db.store.create({
      data: { ...data, householdId: id, verified: false }, // user-entered: never shown as a verified external listing
    })

    logActivity(id, user.id, 'STORE', `${user.name} added store “${store.name}”.`)
    broadcastHousehold(id, 'stores:changed')
    broadcastHousehold(id, 'activity:changed')

    return Response.json({ store }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
