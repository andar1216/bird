import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { HttpError, parse } from '../lib/http.js'
import { decryptSecret, encryptSecret } from '../lib/secrets.js'
import { requireAuth } from '../middleware/auth.js'
import { Chat } from '../models/Chat.js'
import { Connection } from '../models/Connection.js'
import { MatrixAccount, serializeMatrixAccount } from '../models/MatrixAccount.js'
import { Message } from '../models/Message.js'
import * as matrix from '../matrix/client.js'
import { startSync, stopSync } from '../matrix/sync.js'

const connectBody = z.object({
  homeserver: z.string().trim().min(1).max(200),
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(500),
})

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
})

// Forget everything that came from this user's Matrix account.
async function forgetMatrixData(userId) {
  const connections = await Connection.find({ userId, provider: 'matrix' })
  const networks = connections.map((c) => c.network)
  const chatIds = await Chat.find({ userId, network: { $in: networks } }).distinct('_id')
  await Message.deleteMany({ userId, chatId: { $in: chatIds } })
  await Chat.deleteMany({ _id: { $in: chatIds } })
  await Connection.deleteMany({ userId, provider: 'matrix' })
}

async function signOutOfHomeserver(account) {
  try {
    await matrix.logout(account.homeserver, decryptSecret(account.accessTokenEnc))
  } catch {
    /* the server may be gone, or the token already dead: nothing more to do */
  }
}

export const matrixRouter = Router()
matrixRouter.use(requireAuth)

matrixRouter.get('/', async (req, res) => {
  const account = await MatrixAccount.findOne({ userId: req.user._id })
  res.json({ account: serializeMatrixAccount(account) ?? null })
})

// Sign in to a Matrix homeserver. The password is only used for this request;
// what we keep is an access token, encrypted.
matrixRouter.put('/', limiter, async (req, res) => {
  const body = parse(connectBody, req.body)
  let homeserver
  try {
    homeserver = matrix.normalizeHomeserver(body.homeserver)
  } catch (err) {
    throw new HttpError(400, err.message)
  }

  let session
  try {
    session = await matrix.login(homeserver, body.username, body.password)
  } catch (err) {
    if (err.errcode === 'M_FORBIDDEN' || err.status === 403 || err.status === 401) {
      throw new HttpError(400, 'The homeserver rejected that username or password')
    }
    throw new HttpError(502, err.message)
  }
  if (!session?.access_token || !session?.user_id) throw new HttpError(502, 'Unexpected reply from the homeserver')

  const userId = req.user._id
  const previous = await MatrixAccount.findOne({ userId })
  if (previous) {
    stopSync(userId)
    await signOutOfHomeserver(previous)
    if (previous.mxid !== session.user_id) await forgetMatrixData(userId)
  }
  const account = await MatrixAccount.findOneAndUpdate(
    { userId },
    {
      homeserver,
      mxid: session.user_id,
      deviceId: session.device_id,
      accessTokenEnc: encryptSecret(session.access_token),
      status: 'syncing',
      $unset: { since: 1, lastError: 1, lastSyncAt: 1 },
    },
    { upsert: true, returnDocument: 'after' },
  )
  startSync(userId)
  res.json({ account: serializeMatrixAccount(account) })
})

matrixRouter.delete('/', async (req, res) => {
  const userId = req.user._id
  const account = await MatrixAccount.findOne({ userId })
  if (account) {
    stopSync(userId)
    await signOutOfHomeserver(account)
    await MatrixAccount.deleteOne({ _id: account._id })
  }
  await forgetMatrixData(userId)
  res.status(204).end()
})
