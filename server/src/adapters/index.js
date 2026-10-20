import { HttpError } from '../lib/http.js'
import { demoAdapter } from './demo.js'

/*
 * Network adapter interface (one per provider, e.g. "demo", later "matrix"):
 *   id: string
 *   connect({ userId, network }) -> Promise<{ label?: string }>
 *       link the account and import chats/messages for that user
 *   sendMessage({ userId, chat, text }) -> Promise<{ status: 'sent' | 'pending' | 'failed' }>
 * Adapters must only read and write documents for the given userId.
 */
const adapters = new Map([[demoAdapter.id, demoAdapter]])

export const PROVIDERS = [...adapters.keys()]

export function getAdapter(provider) {
  const adapter = adapters.get(provider)
  if (!adapter) throw new HttpError(400, `Unknown provider "${provider}"`)
  return adapter
}
