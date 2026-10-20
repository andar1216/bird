import { Chat } from '../../src/models/Chat.js'
import { Message } from '../../src/models/Message.js'
import { DEMO_CHATS } from './demoChats.js'

// Test-only adapter: fills an account with sample conversations and "sends"
// messages locally, so the API can be tested without a real network. It is not
// part of the app (register it with registerAdapter in a test).
export const demoAdapter = {
  id: 'demo',

  // Called when a user connects `network`. Returns a label for the UI.
  async connect({ userId, network }) {
    const now = Date.now()
    for (const demo of DEMO_CHATS.filter((c) => c.network === network)) {
      const exists = await Chat.exists({ userId, network, externalId: demo.externalId })
      if (exists) continue

      const { messages, ...fields } = demo
      const docs = messages.map((m) => ({
        userId,
        from: m.from,
        sender: m.sender,
        type: m.type ?? 'text',
        text: m.text,
        caption: m.caption,
        duration: m.duration,
        sentAt: new Date(now - m.ago * 60_000),
        status: 'sent',
      }))
      const last = docs[docs.length - 1]
      const chat = await Chat.create({
        userId,
        ...fields,
        lastMessage: {
          from: last.from,
          sender: last.sender,
          type: last.type,
          text: last.text,
          sentAt: last.sentAt,
        },
        lastMessageAt: last.sentAt,
      })
      await Message.insertMany(docs.map((d) => ({ ...d, chatId: chat._id })))
    }
    return { label: 'Demo data' }
  },

  // Deliver an outgoing message. Returns the delivery status to store.
  async sendMessage() {
    return { status: 'sent' }
  },
}
