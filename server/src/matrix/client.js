import { randomUUID } from 'node:crypto'

// A small Matrix client-server API client (https://spec.matrix.org). Only what
// Bird needs: log in, sync, send a text message, mark read, log out.
// Note: end-to-end encrypted rooms are not supported, so bridges must run with
// encryption off (the default for the mautrix bridges).

export class MatrixError extends Error {
  constructor(message, { status = 0, errcode } = {}) {
    super(message)
    this.status = status
    this.errcode = errcode
  }
}

const isLoopback = (host) => host === 'localhost' || host === '[::1]' || /^127\./.test(host)

// "matrix.example.com" or "https://matrix.example.com/" -> "https://matrix.example.com".
// Plain http is only accepted for this computer (a homeserver you run locally).
export function normalizeHomeserver(input) {
  const raw = String(input ?? '').trim()
  if (!raw) throw new MatrixError('Enter your homeserver address')
  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new MatrixError('That homeserver address is not valid')
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    throw new MatrixError('Use an https:// homeserver address (http is only allowed for localhost)')
  }
  if (url.username || url.password) throw new MatrixError('Do not put credentials in the address')
  return url.origin
}

async function request(homeserver, method, path, { token, body, query, timeoutMs = 20_000, signal } = {}) {
  const url = new URL(`/_matrix/client/v3${path}`, homeserver)
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new MatrixError(`Could not reach the homeserver (${err.cause?.code ?? err.message})`)
  }
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    throw new MatrixError(data?.error ?? `Homeserver returned ${res.status}`, {
      status: res.status,
      errcode: data?.errcode,
    })
  }
  return data
}

export function login(homeserver, username, password) {
  return request(homeserver, 'POST', '/login', {
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: username },
      password,
      initial_device_display_name: 'Bird',
    },
  })
}

export const logout = (homeserver, token) => request(homeserver, 'POST', '/logout', { token, body: {} })

export const whoami = (homeserver, token) => request(homeserver, 'GET', '/account/whoami', { token })

// `timeout` is how long (ms) the server may hold the request open waiting for news.
export function sync(homeserver, token, { since, timeout = 0, filter, signal }) {
  return request(homeserver, 'GET', '/sync', {
    token,
    query: {
      since,
      timeout: String(timeout),
      filter: JSON.stringify(filter),
      set_presence: 'offline',
    },
    timeoutMs: timeout + 30_000,
    signal,
  })
}

// Current state of a room, for rooms the sync response did not describe.
export const roomState = (homeserver, token, roomId) =>
  request(homeserver, 'GET', `/rooms/${encodeURIComponent(roomId)}/state`, { token })

export function sendText(homeserver, token, roomId, text, txnId = randomUUID()) {
  return request(
    homeserver,
    'PUT',
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`,
    { token, body: { msgtype: 'm.text', body: text } },
  )
}

export const joinRoom = (homeserver, token, roomId) =>
  request(homeserver, 'POST', `/join/${encodeURIComponent(roomId)}`, { token, body: {} })

export const markRead = (homeserver, token, roomId, eventId) =>
  request(
    homeserver,
    'POST',
    `/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
    { token, body: {} },
  )
