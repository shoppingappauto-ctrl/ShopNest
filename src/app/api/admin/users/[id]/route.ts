import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError, requireUser, ApiError } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  isSuspended: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireUser()
    if (!admin.isAdmin) throw new ApiError(403, 'Admin access required.')
    const { id } = await params

    if (id === admin.id) throw new ApiError(400, 'You cannot modify your own admin status or suspension.')

    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new ApiError(404, 'User not found.')

    const data = await parseBody(req, patchSchema)

    // last-admin guard: never allow demoting/suspending the final platform admin
    if ((data.isAdmin === false || data.isSuspended === true) && target.isAdmin) {
      const adminCount = await db.user.count({ where: { isAdmin: true, isSuspended: false } })
      if (adminCount <= 1) {
        throw new ApiError(409, 'This is the last active administrator — promote another admin first.')
      }
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, isAdmin: true, isSuspended: true },
    })
    return Response.json({ user: updated })
  } catch (error) {
    return jsonError(error)
  }
}
