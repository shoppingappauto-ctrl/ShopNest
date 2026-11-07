import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, jsonError, requireHouseholdAccess, requireUser } from '@/lib/shopnest/auth'
import { logActivity, parseBody, validatePhotoDataUrl } from '@/lib/shopnest/api-helpers'
import { broadcastHousehold } from '@/lib/shopnest/notify'

type Params = { params: Promise<{ id: string }> }

const photoSchema = z.object({
  dataUrl: z.string().min(30),
})

/** Attach a compressed photo (base64 data URL) to a shopping item — used for “is this the right product?” questions. */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params

    const item = await db.shoppingItem.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    const { dataUrl } = await parseBody(req, photoSchema)
    const safeDataUrl = validatePhotoDataUrl(dataUrl)

    // storage quota guard: max 8 photos per item in the free build
    const count = await db.itemPhoto.count({ where: { itemId: item.id } })
    if (count >= 8) {
      throw new ApiError(403, 'This item already has 8 photos. Remove one first.')
    }

    const photo = await db.itemPhoto.create({
      data: { itemId: item.id, uploadedById: user.id, dataUrl: safeDataUrl },
      select: { id: true, dataUrl: true, createdAt: true, uploadedById: true },
    })

    logActivity(item.householdId, user.id, 'PHOTO', `${user.name} attached a photo to “${item.name}”.`)
    broadcastHousehold(item.householdId, 'items:changed')
    broadcastHousehold(item.householdId, 'activity:changed')

    return Response.json({ photo }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}

/** Remove a photo by id (?photoId=...). */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const url = new URL(req.url)
    const photoId = url.searchParams.get('photoId')
    if (!photoId) throw new ApiError(400, 'photoId is required.')

    const photo = await db.itemPhoto.findUnique({ where: { id: photoId } })
    if (!photo || photo.itemId !== id) throw new ApiError(404, 'Photo not found.')

    const item = await db.shoppingItem.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Item not found.')
    await requireHouseholdAccess(user.id, item.householdId)

    await db.itemPhoto.delete({ where: { id: photoId } })
    broadcastHousehold(item.householdId, 'items:changed')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
