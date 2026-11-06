import { z } from 'zod'
import { db } from '@/lib/db'
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  jsonError,
  verifyPassword,
  ApiError,
} from '@/lib/shopnest/auth'
import { parseBody } from '@/lib/shopnest/api-helpers'

const AVATAR_COLORS = ['#16a34a', '#ea580c', '#dc2626', '#0d9488', '#9333ea', '#ca8a04', '#be185d', '#4d7c0f']

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
})

export async function POST(req: Request) {
  try {
    const { name, email, password } = await parseBody(req, registerSchema)

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) throw new ApiError(409, 'An account with this email already exists.')

    const adminExists = await db.user.findFirst({ where: { isAdmin: true } })
    const isFirstUser = !adminExists // first real registrant becomes the platform administrator (demo accounts are never admins)

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        isAdmin: isFirstUser,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)],
        emailVerified: true, // email delivery is unavailable in this sandbox build; accounts are treated as verified
      },
    })

    await createSession(user.id)
    return Response.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
