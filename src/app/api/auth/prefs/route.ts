import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser, jsonError, ApiError } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'

const prefsSchema = z.object({
  notifyPrefs: z
    .object({
      purchases: z.boolean(),
      comments: z.boolean(),
      reminders: z.boolean(),
    })
    .partial()
    .optional(),
  largeText: z.boolean().optional(),
  name: z.string().trim().min(2).max(60).optional(),
})

/** Update the signed-in user's preferences (in-app notifications, accessibility, name). */
export async function PATCH(req: Request) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) throw new ApiError(401, 'You must be signed in.')

    const me = await db.user.findUnique({ where: { id: sessionUser.id }, select: { notifyPrefs: true } })
    const data = await parseBody(req, prefsSchema)

    const patch: Record<string, unknown> = {}
    if (data.largeText !== undefined) patch.largeText = data.largeText
    if (data.name) patch.name = data.name
    if (data.notifyPrefs) {
      let current: Record<string, boolean> = { purchases: true, comments: true, reminders: true }
      try {
        if (me?.notifyPrefs) current = { ...current, ...JSON.parse(me.notifyPrefs) }
      } catch {
        // ignore malformed stored prefs
      }
      patch.notifyPrefs = JSON.stringify({ ...current, ...data.notifyPrefs })
    }

    const updated = await db.user.update({
      where: { id: sessionUser.id },
      data: patch,
      select: { id: true, name: true, notifyPrefs: true, largeText: true },
    })
    return Response.json({ user: updated })
  } catch (error) {
    return jsonError(error)
  }
}
