import { io } from 'socket.io-client'

const socket = io('http://127.0.0.1:3003', { transports: ['websocket', 'polling'], forceNew: true })
socket.on('connect', () => {
  console.log('client connected:', socket.id)
  socket.emit('join', { householdIds: ['test-hh'] })
  setTimeout(() => {
    fetch('http://127.0.0.1:3004/internal/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: 'hh:test-hh', event: 'items:changed', payload: { hello: 1 } }),
    })
      .then((r) => r.json())
      .then((r) => console.log('emit api response:', JSON.stringify(r)))
      .catch((e) => console.error('emit failed', e))
  }, 300)
})
socket.on('items:changed', (payload) => {
  console.log('RECEIVED items:changed', JSON.stringify(payload))
  process.exit(0)
})
setTimeout(() => {
  console.error('TIMEOUT: event not received')
  process.exit(1)
}, 5000)
