import { config } from '../config.js'
import { decryptSecret } from '../lib/secrets.js'
import { Chat } from '../models/Chat.js'
import { Connection } from '../models/Connection.js'
import { MatrixAccount } from '../models/MatrixAccount.js'
import { Message } from '../models/Message.js'
import * as matrix from './client.js'
import {
  colorsFor,
  eventToMessage,
  memberNames,
  networkFromState,
  roomDetails,
  serverOf,
} from './mapping.js'

// Keeps each user's Chat and Message documents in step with their Matrix
// account by running /sync in the background.

const SYNC_FILTER = {
  room: {
    timeline: { limit: 20 },
    state: { lazy_load_members: true },
    ephemeral: { types: [] },
    account_data: { types: [] },
  },
  presence: { types: [] },
  account_data: { types: [] },
}

const running = new Map() // userId -> AbortController

// Display names seen in each room, so group messages can show who sent them.
const namesByRoom = new Map() // `${userId}:${roomId}` -> Map(mxid -> name)

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true })
  })

// Join rooms we were invited to, but only when the invite comes from our own
// homeserver (the bridges' bot and puppets), never from strangers elsewhere.
async function acceptInvites(account, token, invites) {
  for (const [roomId, room] of Object.entries(invites)) {
    const mine = (room.invite_state?.events ?? []).find(
      (e) => e.type === 'm.room.member' && e.state_key === account.mxid,
    )
    if (!mine || serverOf(mine.sender) !== serverOf(account.mxid)) continue
    try {
      await matrix.joinRoom(account.homeserver, token, roomId)
    } catch (err) {
      console.warn(`[matrix] could not join ${roomId}: ${err.message}`)
    }
  }
}

// Store one joined room's news. Returns the Bird network the room belongs to.
async function applyRoom(account, token, roomId, room) {
  const { userId, mxid } = account
  const timeline = room.timeline?.events ?? []
  const stateEvents = [
    ...(room.state?.events ?? []),
    ...timeline.filter((e) => e.state_key !== undefined),
  ]

  const key = `${userId}:${roomId}`
  const names = namesByRoom.get(key) ?? new Map()
  namesByRoom.set(key, memberNames(stateEvents, names))

  const existing = await Chat.findOne({ userId, externalId: roomId })
  let network = networkFromState(stateEvents) ?? existing?.network
  let { name, group } = roomDetails(stateEvents, room.summary, mxid, names)
  name ??= existing?.name
  group ??= existing?.group

  // A room we know nothing about (no earlier chat, no state in this batch).
  if (!network || !name) {
    try {
      const events = await matrix.roomState(account.homeserver, token, roomId)
      memberNames(events, names)
      network ??= networkFromState(events) ?? 'matrix'
      name ??= roomDetails(events, room.summary, mxid, names).name
    } catch {
      /* fall back below */
    }
  }
  network ??= 'matrix'
  name ??= 'Unnamed chat'
  group ??= false

  const messages = timeline
    .map((ev) => eventToMessage(ev, { myMxid: mxid, group, names }))
    .filter(Boolean)
    .sort((a, b) => a.sentAt - b.sentAt)

  const fields = { network, name, group }
  const notifications = room.unread_notifications
  if (notifications && typeof notifications.notification_count === 'number') {
    fields.unread = notifications.notification_count
    fields.mention = (notifications.highlight_count ?? 0) > 0
  }
  const last = messages.at(-1)
  if (last && (!existing?.lastMessageAt || last.sentAt >= existing.lastMessageAt)) {
    fields.lastMessage = {
      from: last.from,
      sender: last.sender,
      type: last.type,
      text: last.text,
      sentAt: last.sentAt,
    }
    fields.lastMessageAt = last.sentAt
    fields.lastEventId = last.externalId
  }

  const chat = existing
    ? await Chat.findByIdAndUpdate(existing._id, { $set: fields }, { returnDocument: 'after' })
    : await Chat.create({ userId, externalId: roomId, colors: colorsFor(name), ...fields })

  if (messages.length) {
    await Message.bulkWrite(
      messages.map(({ externalId, ...m }) => ({
        updateOne: {
          filter: { userId, externalId },
          // If we sent it ourselves the message is already there: leave it alone.
          update: { $setOnInsert: { ...m, userId, chatId: chat._id, externalId, status: 'sent' } },
          upsert: true,
        },
      })),
      { ordered: false },
    )
  }
  return network
}

async function removeRoom(userId, roomId) {
  const chat = await Chat.findOne({ userId, externalId: roomId })
  if (!chat) return
  await Message.deleteMany({ userId, chatId: chat._id })
  await Chat.deleteOne({ _id: chat._id })
  namesByRoom.delete(`${userId}:${roomId}`)
}

// Apply one /sync response to the database.
export async function applySync(account, data, token) {
  const { userId, mxid } = account
  const seen = new Set()
  for (const [roomId, room] of Object.entries(data.rooms?.join ?? {})) {
    seen.add(await applyRoom(account, token, roomId, room))
  }
  for (const roomId of Object.keys(data.rooms?.leave ?? {})) await removeRoom(userId, roomId)
  await acceptInvites(account, token, data.rooms?.invite ?? {})

  // Every network that has chats is "connected", provided by this account.
  for (const network of seen) {
    await Connection.findOneAndUpdate(
      { userId, network },
      { provider: 'matrix', status: 'connected', label: mxid, lastSyncAt: new Date() },
      { upsert: true },
    )
  }
}

async function run(userId, signal) {
  let backoff = 1_000
  while (!signal.aborted) {
    const account = await MatrixAccount.findOne({ userId })
    if (!account) return
    try {
      const token = decryptSecret(account.accessTokenEnc)
      const first = !account.since
      const data = await matrix.sync(account.homeserver, token, {
        since: account.since,
        timeout: first ? 0 : config.matrixSyncTimeoutMs,
        filter: SYNC_FILTER,
        signal,
      })
      if (signal.aborted) return
      await applySync(account, data, token)
      await MatrixAccount.updateOne(
        { _id: account._id },
        { $set: { since: data.next_batch, status: 'syncing', lastSyncAt: new Date() }, $unset: { lastError: 1 } },
      )
      backoff = 1_000
    } catch (err) {
      if (signal.aborted) return
      if (err.errcode === 'M_UNKNOWN_TOKEN') {
        await MatrixAccount.updateOne(
          { _id: account._id },
          { status: 'error', lastError: 'The homeserver signed Bird out. Connect again.' },
        )
        return
      }
      console.warn(`[matrix] sync for ${userId} failed: ${err.message}`)
      await MatrixAccount.updateOne({ _id: account._id }, { status: 'error', lastError: err.message })
      await sleep(backoff, signal)
      backoff = Math.min(backoff * 2, 60_000)
    }
  }
}

export function startSync(userId) {
  stopSync(userId)
  const controller = new AbortController()
  running.set(String(userId), controller)
  run(userId, controller.signal)
    .catch((err) => console.error('[matrix] sync stopped:', err))
    .finally(() => {
      if (running.get(String(userId)) === controller) running.delete(String(userId))
    })
}

export function stopSync(userId) {
  running.get(String(userId))?.abort()
  running.delete(String(userId))
}

export function stopAllSync() {
  for (const controller of running.values()) controller.abort()
  running.clear()
}

export const isSyncing = (userId) => running.has(String(userId))

// On server start: resume every saved account.
export async function startAllSync() {
  for (const { userId } of await MatrixAccount.find({}).select('userId')) {
    startSync(userId)
  }
}
