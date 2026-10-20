import { HttpError } from '../lib/http.js'

/*
 * Network adapter interface (one per provider, e.g. "matrix"):
 *   id: string
 *   connect({ userId, network }) -> Promise<{ label?: string }>
 *       link the account and import chats/messages for that user
 *   sendMessage({ userId, chat, text }) -> Promise<{ status: 'sent' | 'pending' | 'failed' }>
 * Adapters must only read and write documents for the given userId.
 *
 * No adapters ship yet, so no chats are created for you. Add one with
 * registerAdapter() when a real provider is built.
 */
const adapters = new Map()

export function registerAdapter(adapter) {
  adapters.set(adapter.id, adapter)
}

export function getAdapter(provider) {
  const adapter = adapters.get(provider)
  if (!adapter) throw new HttpError(400, `Unknown provider "${provider}"`)
  return adapter
}
