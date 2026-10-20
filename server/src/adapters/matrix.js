import { HttpError } from '../lib/http.js'
import { decryptSecret } from '../lib/secrets.js'
import { MatrixAccount } from '../models/MatrixAccount.js'
import * as matrix from '../matrix/client.js'

// Chats come from the user's Matrix account (see matrix/sync.js, which fills the
// database in the background); this adapter sends messages and read receipts.
async function accountFor(userId) {
  const account = await MatrixAccount.findOne({ userId })
  if (!account) throw new HttpError(409, 'Connect a Matrix account first')
  return { account, token: decryptSecret(account.accessTokenEnc) }
}

export const matrixAdapter = {
  id: 'matrix',

  async connect({ userId }) {
    const { account } = await accountFor(userId)
    return { label: account.mxid }
  },

  async sendMessage({ userId, chat, text }) {
    try {
      const { account, token } = await accountFor(userId)
      const { event_id: externalId } = await matrix.sendText(
        account.homeserver,
        token,
        chat.externalId,
        text,
      )
      return { status: 'sent', externalId }
    } catch (err) {
      console.warn(`[matrix] could not send: ${err.message}`)
      return { status: 'failed' }
    }
  },

  async markRead({ userId, chat }) {
    if (!chat.lastEventId) return
    const { account, token } = await accountFor(userId)
    await matrix.markRead(account.homeserver, token, chat.externalId, chat.lastEventId)
  },
}
