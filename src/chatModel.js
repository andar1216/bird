import { formatTime } from './format'

// Map server documents to the shapes the UI components already use.
export function toUiMessage(m) {
  return {
    id: m.id,
    from: m.from,
    sender: m.sender,
    type: m.type,
    text: m.text,
    caption: m.caption,
    duration: m.duration,
    status: m.status,
    sentAt: m.sentAt,
    time: formatTime(m.sentAt),
  }
}

export function toUiChat(c) {
  return { ...c, time: formatTime(c.lastMessageAt), messages: [] }
}

// Update a chat from a fresh server copy while keeping its loaded messages.
export const mergeChat = (old, fresh) => ({ ...toUiChat(fresh), messages: old.messages })
