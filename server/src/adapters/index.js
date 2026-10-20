import { HttpError } from '../lib/http.js'
import { matrixAdapter } from './matrix.js'

/*
 * Network adapter interface (one per provider, e.g. "matrix"):
 *   id: string
 *   connect({ userId, network }) -> Promise<{ label?: string }>
 *       link the account and import chats/messages for that user
 *   sendMessage({ userId, chat, text }) ->
 *       Promise<{ status: 'sent' | 'pending' | 'failed', externalId?: string }>
 *   markRead({ userId, chat }) -> Promise<void>     (optional)
 * Adapters must only read and write documents for the given userId.
 *
 * The Matrix adapter is built in; tests can add their own with registerAdapter().
 */
const adapters = new Map([[matrixAdapter.id, matrixAdapter]])

export function registerAdapter(adapter) {
  adapters.set(adapter.id, adapter)
}

export function getAdapter(provider) {
  const adapter = adapters.get(provider)
  if (!adapter) throw new HttpError(400, `Unknown provider "${provider}"`)
  return adapter
}
