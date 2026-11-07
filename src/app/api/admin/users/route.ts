import { db } from '@/lib/db'
import { jsonError, requireUser, ApiError } from '@/lib/shopnest/auth'

/** Admin user management — search accounts. Private household data is never exposed here. */
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    if (!user.isAdmin) throw new ApiError(403, 'Admin access required.')

    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
    const users = await db.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
            ],
          }
        : {},
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        isSuspended: true,
        createdAt: true,
        lastActiveAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return Response.json({ users })
  } catch (error) {
    return jsonError(error)
  }
}
