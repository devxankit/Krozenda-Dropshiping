import { io } from 'socket.io-client'
import { env } from '../config/env'
import { storage } from './storage'

// The websocket client, as one shared connection.
//
// One socket per tab, not one per screen: a panel with six mounted components
// that each want order updates should not open six connections. Subscribers
// register a callback here and the module fans out.
//
// The token goes in `auth`, which is what the server reads (see
// Router/socketHandler) — never in the query string, where it would end up in
// proxy access logs.

let socket = null
const listeners = new Map() // event -> Set<handler>

// The socket server lives at the API's origin, not under its /api/v1 path.
// A relative apiBaseUrl (the dev proxy case) means same-origin, which is what
// socket.io assumes when given no URL at all.
function socketUrl() {
  const base = env.apiBaseUrl
  if (!base || base.startsWith('/')) return undefined
  try {
    return new URL(base).origin
  } catch {
    return undefined
  }
}

function emitToListeners(event, payload) {
  const handlers = listeners.get(event)
  if (!handlers) return
  for (const handler of handlers) {
    try {
      handler(payload)
    } catch {
      // One bad subscriber must not stop the others from being told.
    }
  }
}

export function connectRealtime() {
  const token = storage.getAccessToken()
  // No token means nothing to subscribe to. The server would refuse the
  // handshake anyway; not attempting it avoids a pointless retry loop.
  if (!token) return null
  if (socket?.connected) return socket

  if (socket) socket.disconnect()

  socket = io(socketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    // The server refuses an unauthenticated handshake outright. Retrying that
    // forever would hammer it, so reconnection is capped and a rejected auth
    // stops it entirely (below).
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect_error', (err) => {
    if (err?.message === 'UNAUTHENTICATED') {
      // A stale or wrong-audience token. Reconnecting cannot fix it; the next
      // sign-in calls connectRealtime again with a fresh one.
      socket?.disconnect()
    }
  })

  for (const event of ['notification', 'order:updated', 'shipment:updated']) {
    socket.on(event, (payload) => emitToListeners(event, payload))
  }

  return socket
}

export function disconnectRealtime() {
  socket?.disconnect()
  socket = null
  listeners.clear()
}

/**
 * Subscribe to one server event. Returns an unsubscribe function, which is
 * what a React effect returns for cleanup.
 */
export function onRealtime(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(handler)

  // Lazily connect on first subscription, so a screen that never subscribes
  // never opens a socket.
  connectRealtime()

  return () => {
    listeners.get(event)?.delete(handler)
  }
}
