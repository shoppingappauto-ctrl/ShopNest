import { cookies, headers } from 'next/headers'
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
  await setSessionCookie(token)
  return token
}

/**
 * Session cookie strategy (V2 hardening — Safari & storage-safe):
 *
 *  • First-party / same-site web (Safari, Chrome, Firefox, mobile web): the
 *    session lives entirely in an `HttpOnly; Secure; SameSite=Lax` cookie.
 *    No token is ever exposed to JavaScript, so XSS cannot exfiltrate it.
 *    `SameSite=Lax` is supported by every current browser (including Safari,
 *    which does NOT support CHIPS `Partitioned` cookies — the previous build
 *    relied on CHIPS and silently failed on Safari).
 *
 *  • Cross-origin iframe (e.g. the embedded preview panel): a Lax cookie is
 *    neither set nor sent, so the API also returns the opaque token in the
 *    login JSON body. The web client persists it ONLY to `sessionStorage`
 *    (tab-scoped, cleared on tab close — never long-lived `localStorage`)
 *    and sends it as `Authorization: Bearer`. See lib/shopnest/client.ts.
 *
 *  • Native mobile clients: the same opaque token is stored in the OS
 *    Keychain/Keystore via expo-secure-store (apps/mobile). See SECURITY.md.
 *
 * `Secure` is set unconditionally: localhost is exempt in every major browser,
 * and production is served over HTTPS via the gateway.
 */
async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

/** Returns the opaque session token carried by the current request, if any. */
export async function getRequestSessionToken(): Promise<string | null> {
  try {
    const h = await headers()
    const auth = h.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      const t = auth.slice(7).trim()
      if (t) return t
    }
  } catch {
    // headers() unavailable
  }
  try {
    const store = await cookies()
    return store.get(SESSION_COOKIE)?.value ?? null
  } catch {
    return null
  }
}

/**
 * Sliding "session refresh": if the current session expires within the
 * refresh window, extend its TTL by SESSION_TTL_DAYS and re-stamp the cookie.
 * Does NOT rotate the token (no new credential is issued). Returns whether the
 * expiry was extended and the new expiry time.
 */
export async function refreshSessionIfNeeded(
  refreshWithinDays = 7
): Promise<{ refreshed: boolean; expiresAt: Date }> {
  const token = await getRequestSessionToken()
  if (!token) throw new ApiError(401, 'You must be signed in.')
  const session = await db.session.findUnique({ where: { id: token } })
  if (!session || session.expiresAt < new Date()) {
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }
  const threshold = new Date(Date.now() + refreshWithinDays * 24 * 60 * 60 * 1000)
  if (session.expiresAt > threshold) {
    return { refreshed: false, expiresAt: session.expiresAt }
  }
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db.session.update({ where: { id: token }, data: { expiresAt } })
  await setSessionCookie(token)
  return { refreshed: true, expiresAt }
}

export async function destroySession(): Promise<void> {
  // resolve the token from the Authorization header or the cookie
  let token: string | undefined
  try {
    const h = await headers()
    const auth = h.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7).trim() || undefined
  } catch {
    // headers() unavailable — cookie-only
  }
  if (!token) {
    const store = await cookies()
    token = store.get(SESSION_COOKIE)?.value
  }
  if (token) {
    await db.session.deleteMany({ where: { id: token } })
  }
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  })
}

/** Returns the authenticated user for the current request, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Prefer the Authorization header (works even when the iframe environment
  // blocks cookies entirely), then fall back to the session cookie.
  let token: string | undefined
  try {
    const h = await headers()
    const auth = h.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7).trim() || undefined
  } catch {
    // headers() unavailable in this context — cookie-only
  }
  if (!token) {
    const store = await cookies()
    token = store.get(SESSION_COOKIE)?.value
  }
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
