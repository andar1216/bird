import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { getAdapter } from '../adapters/index.js'
import { HttpError, parse } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { Chat, serializeChat } from '../models/Chat.js'
import { Connection } from '../models/Connection.js'
import { Message, serializeMessage } from '../models/Message.js'

const sendBody = z.object({ text: z.string().trim().min(1).max(4000) })
const patchBody = z
  .object({
    pinned: z.boolean(),
    muted: z.boolean(),
    lowPriority: z.boolean(),
    archived: z.boolean(),
  })
  .partial()
  .strict()
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.date().optional(),
})

// Loads a chat only if it belongs to the signed-in user (404 otherwise, so ids
// of other users' chats are indistinguishable from ids that do not exist).
async function ownedChat(req) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Chat not found')
  const chat = await Chat.findOne({ _id: id, userId: req.user._id })
  if (!chat) throw new HttpError(404, 'Chat not found')
  return chat
}

export const chatsRouter = Router()
chatsRouter.use(requireAuth)

chatsRouter.get('/', async (req, res) => {
  const chats = await Chat.find({ userId: req.user._id }).sort({ lastMessageAt: -1 }).limit(500)
  res.json({ chats: chats.map(serializeChat) })
})

chatsRouter.get('/:id/messages', async (req, res) => {
  const chat = await ownedChat(req)
  const { limit, before } = parse(listQuery, req.query)
  const filter = { userId: req.user._id, chatId: chat._id }
  if (before) filter.sentAt = { $lt: before }
  const newestFirst = await Message.find(filter).sort({ sentAt: -1, _id: -1 }).limit(limit)
  // Oldest to newest so the UI can render the page as-is.
  res.json({ messages: newestFirst.reverse().map(serializeMessage) })
})

chatsRouter.post('/:id/messages', async (req, res) => {
  const chat = await ownedChat(req)
  const { text } = parse(sendBody, req.body)
  const connection = await Connection.findOne({ userId: req.user._id, network: chat.network })
  if (!connection || connection.status !== 'connected') {
    throw new HttpError(409, `${chat.network} is not connected`)
  }

  const { status } = await getAdapter(connection.provider).sendMessage({
    userId: req.user._id,
    chat,
    text,
  })
  const sentAt = new Date()
  const message = await Message.create({
    userId: req.user._id,
    chatId: chat._id,
    from: 'me',
    type: 'text',
    text,
    sentAt,
    status,
  })
  chat.lastMessage = { from: 'me', type: 'text', text, sentAt }
  chat.lastMessageAt = sentAt
  await chat.save()
  res.status(201).json({ message: serializeMessage(message), chat: serializeChat(chat) })
})

chatsRouter.post('/:id/read', async (req, res) => {
  const chat = await ownedChat(req)
  chat.unread = 0
  chat.mention = false
  await chat.save()
  res.json({ chat: serializeChat(chat) })
})

chatsRouter.patch('/:id', async (req, res) => {
  const chat = await ownedChat(req)
  chat.set(parse(patchBody, req.body))
  await chat.save()
  res.json({ chat: serializeChat(chat) })
})
