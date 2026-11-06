/**
 * ShopNest Realtime Sync Service
 * --------------------------------
 * Socket.io service that keeps household shopping lists in sync.
 *
 * - Clients join rooms scoped to their households (`hh:<id>`).
 * - The Next.js API server broadcasts change events after persisting
 *   mutations via the internal HTTP endpoint (`/internal/emit`).
 * - Events carry the changed entity type so clients can refetch
 *   the exact query keys (server-confirmed persistence + optimistic UI).
 */
import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const PORT = 3003 // public socket.io endpoint (via Caddy: /?XTransformPort=3003)
const INTERNAL_PORT = 3004 // localhost-only internal emit API used by the Next.js API server

const roomOf = (householdId: string) => `hh:${householdId}`

io.on('connection', (socket) => {
  console.log(`[shopnest-socket] connected: ${socket.id}`)

  socket.on('join', (data: { householdIds?: string[] }) => {
    const ids = Array.isArray(data?.householdIds) ? data.householdIds : []
    for (const id of ids.slice(0, 50)) {
      if (typeof id === 'string' && id.length > 0) {
        socket.join(roomOf(id))
        console.log(`[shopnest-socket] ${socket.id} joined ${roomOf(id)}`)
      }
    }
  })

  socket.on('leave', (data: { householdId?: string }) => {
    if (data?.householdId) socket.leave(roomOf(data.householdId))
  })

  socket.on('disconnect', () => {
    console.log(`[shopnest-socket] disconnected: ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`[shopnest-socket] socket error (${socket.id}):`, error)
  })
})

// Internal emit endpoint used by the Next.js API server (server-to-server, not exposed via Caddy).
// Runs on its own localhost-only port because socket.io (path '/') owns every request on PORT.
type EmitBody = {
  room?: string
  event?: string
  payload?: unknown
}

const httpOk = (res: import('http').ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const internalServer = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://internal')
  if (url.pathname === '/health') {
    return httpOk(res, 200, { ok: true, service: 'shopnest-socket', clients: io.engine.clientsCount })
  }
  if (url.pathname === '/internal/emit' && req.method === 'POST') {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 256_000) req.destroy() // abuse guard
    })
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}') as EmitBody
        if (!body.room || !body.event) {
          return httpOk(res, 400, { ok: false, error: 'room and event are required' })
        }
        io.to(body.room).emit(body.event, body.payload ?? {})
        return httpOk(res, 200, { ok: true })
      } catch {
        return httpOk(res, 400, { ok: false, error: 'invalid json' })
      }
    })
    return
  }
  return httpOk(res, 404, { ok: false, error: 'not found' })
})

internalServer.listen(INTERNAL_PORT, () => {
  console.log(`[shopnest-socket] internal emit API on port ${INTERNAL_PORT}`)
})

httpServer.listen(PORT, () => {
  console.log(`[shopnest-socket] realtime service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[shopnest-socket] SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[shopnest-socket] SIGINT received, shutting down...')
  httpServer.close(() => process.exit(0))
})
