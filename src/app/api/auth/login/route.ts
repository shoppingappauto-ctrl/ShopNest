import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, jsonError, verifyPassword, ApiError } from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export async function POST(req: Request) {
  try {
    const { email, password } = await parseBody(req, loginSchema)
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, 'Incorrect email or password.')
    }
    if (user.isSuspended) {
      throw new ApiError(403, 'This account has been suspended. Contact support.')
    }
    await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
    await createSession(user.id)
    return Response.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } })
  } catch (error) {
    return jsonError(error)
  }
}
