import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const SESSION_COOKIE = 'sn_session'
const SESSION_TTL_DAYS = 30

export type SessionUser = {
  id: string
  email: string
  name: string
  avatarColor: string
  isAdmin: boolean
  isSuspended: boolean
  emailVerified: boolean
  createdAt: Date
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash)
  } catch {
    return false
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({ data: { id: token, userId, expiresAt } })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // sandbox preview is served over http via the gateway
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
  return token
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { id: token } })
  }
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

/** Returns the authenticated user for the current request, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  if (session.user.isSuspended) return null

  // touch last-active (fire and forget, throttled by 60s window)
  const now = Date.now()
  const last = session.user.lastActiveAt?.getTime() ?? 0
  if (now - last > 60_000) {
    db.user
      .update({ where: { id: session.user.id }, data: { lastActiveAt: new Date() } })
      .catch(() => {})
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarColor: session.user.avatarColor,
    isAdmin: session.user.isAdmin,
    isSuspended: session.user.isSuspended,
    emailVerified: session.user.emailVerified,
    createdAt: session.user.createdAt,
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Throws ApiError(401) when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'You must be signed in.')
  return user
}

export type HouseholdAccess = {
  userId: string
  householdId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  isAdmin: boolean
}

/** Throws ApiError(403/404) unless the user is a member of the household. */
export async function requireHouseholdAccess(
  userId: string,
  householdId: string
): Promise<HouseholdAccess> {
  const membership = await db.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  })
  if (!membership) throw new ApiError(403, 'You are not a member of this household.')
  return {
    userId,
    householdId,
    role: membership.role as HouseholdAccess['role'],
    isAdmin: membership.role === 'OWNER' || membership.role === 'ADMIN',
  }
}

/** Throws unless the member can manage the household (OWNER/ADMIN). */
export async function requireHouseholdManager(
  userId: string,
  householdId: string
): Promise<HouseholdAccess> {
  const access = await requireHouseholdAccess(userId, householdId)
  if (!access.isAdmin) {
    throw new ApiError(403, 'Only household owners and admins can do this.')
  }
  return access
}

/** Generates a friendly, unambiguous invite code, e.g. SN-7K2QP4 */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `SN-${code}`
}

export function jsonError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error('[shopnest-api]', error)
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}
