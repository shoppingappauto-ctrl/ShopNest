import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

/** Simple household pantry — statuses: IN_STOCK | RUNNING_LOW | OUT_OF_STOCK | UNKNOWN. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const items = await db.pantryItem.findMany({
      where: { householdId: id },
      include: { householdProduct: { select: { id: true, name: true } } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })
    return Response.json({ items })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(30).default('OTHER'),
  quantity: z.number().positive().max(9999).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  status: z.enum(['IN_STOCK', 'RUNNING_LOW', 'OUT_OF_STOCK', 'UNKNOWN']).default('UNKNOWN'),
  householdProductId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)
    const data = await parseBody(req, createSchema)

    if (data.householdProductId) {
      const product = await db.householdProduct.findFirst({ where: { id: data.householdProductId, householdId: id } })
      if (!product) throw new ApiError(404, 'Household product not found.')
    }

    const item = await db.pantryItem.create({
      data: {
        householdId: id,
        name: data.name,
        nameBn: data.nameBn || null,
        category: data.category,
        quantity: data.quantity ?? null,
        unit: data.unit || null,
        status: data.status,
        householdProductId: data.householdProductId || null,
        notes: data.notes || null,
        updatedById: user.id,
      },
      include: { householdProduct: { select: { id: true, name: true } } },
    })

    logActivity(id, user.id, 'PANTRY', `${user.name} added “${data.name}” to the pantry.`)
    broadcastHousehold(id, 'activity:changed')
    return Response.json({ item }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
