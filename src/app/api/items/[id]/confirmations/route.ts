import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody, validatePhotoDataUrl } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

const createSchema = z.object({
  note: z.string().trim().max(300).optional().nullable(),
  // optional photo, uploaded inline as a compressed data URL and stored as a
  // private ItemPhoto (household-scoped access only — never public)
  photoDataUrl: z.string().optional().nullable(),
})

/**
 * "Ask Family" — create a photo-confirmation request for an item.
 * The shopper keeps shopping while the family responds.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const item = await db.shoppingItem.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    const data = await parseBody(req, createSchema)

    // only one open request per item at a time
    const open = await db.itemConfirmationRequest.findFirst({
      where: { itemId: item.id, status: 'PENDING' },
    })
    if (open) throw new ApiError(409, 'This item already has a pending confirmation request.')

    let photoId: string | null = null
    if (data.photoDataUrl) {
      const photo = await db.itemPhoto.create({
        data: {
          itemId: item.id,
          uploadedById: user.id,
          dataUrl: validatePhotoDataUrl(data.photoDataUrl),
        },
      })
      photoId = photo.id
    }

    const request = await db.itemConfirmationRequest.create({
      data: {
        itemId: item.id,
        householdId: item.householdId,
        requestedById: user.id,
        photoId,
        note: data.note || null,
      },
      include: {
        photo: { select: { id: true, dataUrl: true } },
        requestedBy: { select: { id: true, name: true, avatarColor: true } },
      },
    })

    logActivity(
      item.householdId,
      user.id,
      'CONFIRMATION',
      `${user.name} asks the family to confirm “${item.name}”${data.note ? `: “${data.note}”` : ''}.`
    )
    broadcastHousehold(item.householdId, 'items:changed')
    broadcastHousehold(item.householdId, 'activity:changed')

    return Response.json({ request }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}

/** List confirmation requests for an item (most recent first). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const item = await db.shoppingItem.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    const requests = await db.itemConfirmationRequest.findMany({
      where: { itemId: item.id },
      include: {
        photo: { select: { id: true, dataUrl: true } },
        requestedBy: { select: { id: true, name: true, avatarColor: true } },
        decidedBy: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return Response.json({ requests })
  } catch (error) {
    return jsonError(error)
  }
}
