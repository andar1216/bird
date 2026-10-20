// Hiding a conversation from All Chats. A hidden conversation stays hidden until
// there is something new in it: the other person writes, or you do. To tell, we
// remember what the conversation looked like when it was hidden.

// Conversations read from an app's page only have rough times ("4 min", "2 hr"),
// so a later time only counts as new when it is clearly later.
const ROUGH_TIME_SLACK = 2 * 60_000

const TYPING = /^(.{0,40}: )?(typing|recording)\b/i

const atOf = (chat) => Date.parse(chat.lastMessageAt) || 0

// The last message as plain text, ignoring a transient "typing…" preview.
function lastOf(chat) {
  const last = chat.lastMessage
  if (!last) return ''
  const text = String(last.text ?? '')
  if (TYPING.test(text)) return null
  return `${last.from ?? ''}|${last.type ?? ''}|${text}`
}

// What to remember when a conversation is hidden.
export function markFor(chat) {
  return { at: atOf(chat), last: lastOf(chat) ?? '', unread: chat.unread || 0 }
}

// Has anything happened in this conversation since it was hidden?
export function hasNewActivity(chat, mark) {
  if (!mark) return true
  const rough = chat.fromApp === true
  if (atOf(chat) > mark.at + (rough ? ROUGH_TIME_SLACK : 0)) return true
  if ((chat.unread || 0) > mark.unread) return true
  const last = lastOf(chat)
  return last !== null && last !== mark.last
}

// Which of these conversations are currently hidden (hidden, and quiet since).
export function hiddenIds(chats, marks) {
  const out = new Set()
  for (const chat of chats) {
    const mark = marks[chat.id]
    if (mark && !hasNewActivity(chat, mark)) out.add(chat.id)
  }
  return out
}
