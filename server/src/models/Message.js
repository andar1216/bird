import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    // userId is duplicated from the chat on purpose: every query is scoped by it.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    from: { type: String, enum: ['me', 'them'], required: true },
    sender: String, // display name inside group chats
    type: { type: String, enum: ['text', 'image', 'voice'], default: 'text' },
    text: { type: String, maxlength: 4000 },
    caption: { type: String, maxlength: 1000 },
    duration: String, // voice messages, e.g. "0:14"
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'sent' },
    // Id of the message on the remote network (a Matrix event id), if it has one.
    externalId: String,
  },
  { timestamps: true },
)
messageSchema.index({ userId: 1, chatId: 1, sentAt: -1 })
// A remote message is stored once per user, however many times it is reported.
messageSchema.index(
  { userId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } },
)

export const Message = mongoose.model('Message', messageSchema)

export function serializeMessage(m) {
  return {
    id: m.id,
    chatId: m.chatId.toString(),
    from: m.from,
    sender: m.sender,
    type: m.type,
    text: m.text,
    caption: m.caption,
    duration: m.duration,
    sentAt: m.sentAt,
    status: m.status,
  }
}
