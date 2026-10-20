import mongoose from 'mongoose'
import { NETWORKS } from '../networks.js'

const lastMessageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['me', 'them'] },
    sender: String,
    type: { type: String, enum: ['text', 'image', 'voice'], default: 'text' },
    text: String,
    sentAt: Date,
  },
  { _id: false },
)

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    network: { type: String, enum: NETWORKS, required: true },
    // Id of the chat on the remote network; unique per user and network.
    externalId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 120 },
    handle: { type: String, maxlength: 120 },
    colors: { type: [String], default: ['#c9ccd6', '#9298a8'] },
    group: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    lowPriority: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    unread: { type: Number, default: 0, min: 0 },
    mention: { type: Boolean, default: false },
    streak: Number, // Snapchat streak
    lastMessage: lastMessageSchema,
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
chatSchema.index({ userId: 1, network: 1, externalId: 1 }, { unique: true })
chatSchema.index({ userId: 1, lastMessageAt: -1 })

export const Chat = mongoose.model('Chat', chatSchema)

export function serializeChat(c) {
  return {
    id: c.id,
    network: c.network,
    name: c.name,
    handle: c.handle,
    colors: c.colors,
    group: c.group,
    pinned: c.pinned,
    muted: c.muted,
    lowPriority: c.lowPriority,
    archived: c.archived,
    unread: c.unread,
    mention: c.mention,
    streak: c.streak,
    lastMessage: c.lastMessage ?? null,
    lastMessageAt: c.lastMessageAt,
  }
}
