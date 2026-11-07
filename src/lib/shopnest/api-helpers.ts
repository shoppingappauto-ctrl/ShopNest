import { z } from 'zod'
import { db } from '@/lib/db'

/** Parse and validate a JSON request body with zod; throws Error with a readable message. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new Error('Invalid JSON body.')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path?.join('.') ?? ''
    throw new Error(first ? `${path ? path + ': ' : ''}${first.message}` : 'Invalid request body.')
  }
  return result.data
}

/** Write a household activity entry (notifications feed). */
export function logActivity(
  householdId: string,
  userId: string | null,
  type: string,
  message: string
): void {
  db.activity
    .create({ data: { householdId, userId, type, message } })
    .catch(() => {})
}

const MAX_PHOTO_BYTES = 700_000 // ~700KB base64 data URL per photo (client compresses before upload)

const RASTER_MIME = /^data:image\/(png|jpe?g|webp|gif);base64,/

export function validatePhotoDataUrl(dataUrl: string): string {
  if (!RASTER_MIME.test(dataUrl)) {
    throw new Error('Photo must be a PNG, JPEG, WebP or GIF image.')
  }
  if (dataUrl.length > MAX_PHOTO_BYTES) {
    throw new Error('Photo is too large (max ~500KB after compression).')
  }
  return dataUrl
}
