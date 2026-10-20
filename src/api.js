// Client for the Bird server (server/). Auth is an opaque bearer token kept in
// localStorage; the server stores only a hash of it.
const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const TOKEN_KEY = 'bird.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status // 0 = network error (server unreachable)
    this.details = details
  }
}

async function request(method, path, body) {
  const token = getToken()
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the Bird server')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText, data?.details)
  return data
}

export const api = {
  register: (fields) => request('POST', '/api/auth/register', fields),
  login: (fields) => request('POST', '/api/auth/login', fields),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),

  listConnections: () => request('GET', '/api/connections'),
  connect: (network, provider) => request('PUT', `/api/connections/${network}`, { provider }),
  disconnect: (network) => request('DELETE', `/api/connections/${network}`),

  listChats: () => request('GET', '/api/chats'),
  listMessages: (chatId) => request('GET', `/api/chats/${chatId}/messages`),
  sendMessage: (chatId, text) => request('POST', `/api/chats/${chatId}/messages`, { text }),
  markRead: (chatId) => request('POST', `/api/chats/${chatId}/read`),
  patchChat: (chatId, fields) => request('PATCH', `/api/chats/${chatId}`, fields),
}
