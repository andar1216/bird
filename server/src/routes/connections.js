import { Router } from 'express'
import { z } from 'zod'
import { getAdapter, PROVIDERS } from '../adapters/index.js'
import { HttpError, parse } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { Chat } from '../models/Chat.js'
import { Connection } from '../models/Connection.js'
import { Message } from '../models/Message.js'
import { isNetwork, NETWORKS } from '../networks.js'

const connectBody = z.object({ provider: z.enum(PROVIDERS) })

function serialize(network, c) {
  if (!c) return { network, status: 'disconnected' }
  return {
    network,
    provider: c.provider,
    status: c.status,
    label: c.label,
    lastSyncAt: c.lastSyncAt,
  }
}

function networkParam(req) {
  if (!isNetwork(req.params.network)) throw new HttpError(404, 'Unknown network')
  return req.params.network
}

export const connectionsRouter = Router()
connectionsRouter.use(requireAuth)

// All four networks, connected or not, for the current user.
connectionsRouter.get('/', async (req, res) => {
  const rows = await Connection.find({ userId: req.user._id })
  const byNetwork = new Map(rows.map((c) => [c.network, c]))
  res.json({ connections: NETWORKS.map((n) => serialize(n, byNetwork.get(n))) })
})

connectionsRouter.put('/:network', async (req, res) => {
  const network = networkParam(req)
  const { provider } = parse(connectBody, req.body)
  const adapter = getAdapter(provider)
  const userId = req.user._id

  await Connection.findOneAndUpdate(
    { userId, network },
    { provider, status: 'connecting' },
    { upsert: true },
  )
  try {
    const { label } = await adapter.connect({ userId, network })
    const connection = await Connection.findOneAndUpdate(
      { userId, network },
      { status: 'connected', label, lastSyncAt: new Date() },
      { returnDocument: 'after' },
    )
    res.json({ connection: serialize(network, connection) })
  } catch (err) {
    console.error(err)
    await Connection.updateOne({ userId, network }, { status: 'error' })
    throw new HttpError(502, `Could not connect ${network}`)
  }
})

// Disconnecting also forgets that network's chats and messages for this user.
connectionsRouter.delete('/:network', async (req, res) => {
  const network = networkParam(req)
  const userId = req.user._id
  const chatIds = await Chat.find({ userId, network }).distinct('_id')
  await Message.deleteMany({ userId, chatId: { $in: chatIds } })
  await Chat.deleteMany({ userId, network })
  await Connection.deleteOne({ userId, network })
  res.status(204).end()
})
