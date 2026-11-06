import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'
import { EVENT_TYPES } from '@/lib/shopnest/constants'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const events = await db.householdEvent.findMany({
      where: { householdId: id },
      include: {
        items: {
          include: { store: { select: { id: true, name: true, category: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ status: 'asc' }, { date: 'asc' }, { createdAt: 'desc' }],
    })
    return Response.json({ events })
  } catch (error) {
    return jsonError(error)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Event name is required.').max(60),
  type: z.enum(EVENT_TYPES).default('GATHERING'),
  date: z.string().optional().nullable(), // ISO date string
  guestCount: z.number().int().positive().max(2000).optional().nullable(),
  budget: z.number().positive().max(1_000_000).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await requireHouseholdAccess(user.id, id)

    const data = await parseBody(req, createSchema)

    const event = await db.householdEvent.create({
      data: {
        householdId: id,
        name: data.name,
        type: data.type,
        date: data.date ? new Date(data.date) : null,
        guestCount: data.guestCount ?? null,
        budget: data.budget ?? null,
        notes: data.notes || null,
      },
      include: { items: true },
    })

    logActivity(id, user.id, 'EVENT', `${user.name} planned “${event.name}”.`)
    broadcastHousehold(id, 'events:changed')
    broadcastHousehold(id, 'activity:changed')

    return Response.json({ event }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
