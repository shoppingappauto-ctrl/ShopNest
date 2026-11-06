import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { ITEM_CATEGORIES, UNITS } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const products = await db.householdProduct.findMany({
      where: { householdId: id },
      include: { store: { select: { id: true, name: true, category: true } } },
      orderBy: [{ isFavorite: 'desc' }, { timesPurchased: 'desc' }, { name: 'asc' }],
    })
    return Response.json({ products })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.').max(80),
  nameBn: z.string().trim().max(80).optional().nullable(),
  category: z.enum(ITEM_CATEGORIES).default('OTHER'),
  defaultQty: z.number().positive().max(9999).default(1),
  unit: z.enum(UNITS).default('pc'),
  storeId: z.string().trim().optional().nullable(),
  isFavorite: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurrenceDays: z.number().int().positive().max(365).optional().nullable(),
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

    const existing = await db.householdProduct.findFirst({
      where: { householdId: id, name: { equals: data.name } },
    })
    if (existing) throw new ApiError(409, 'This product is already in your household catalog.')

    const product = await db.householdProduct.create({
      data: {
        householdId: id,
        name: data.name,
        nameBn: data.nameBn || null,
        category: data.category,
        defaultQty: data.defaultQty,
        unit: data.unit,
        storeId: data.storeId || null,
        isFavorite: data.isFavorite,
        isRecurring: data.isRecurring,
        recurrenceDays: data.recurrenceDays || null,
      },
      include: { store: { select: { id: true, name: true, category: true } } },
    })

    logActivity(id, user.id, 'PRODUCT', `${user.name} saved “${product.name}” to the household catalog.`)
    broadcastHousehold(id, 'products:changed')

    return Response.json({ product }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
