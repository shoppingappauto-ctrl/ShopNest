import { destroySession, jsonError } from '@/lib/shopnest/auth'

export async function POST() {
  try {
    await destroySession()
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
