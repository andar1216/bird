// Per-conversation choices made in Bird: a star (the person is kept at the top of
// All Chats), a nickname (shown instead of the name the app uses) and a mute (the
// conversation stays out of All Chats, even when something new arrives). Keyed by
// the conversation's id; kept per account on this device.
export const NICK_MAX = 40

const clean = (nick) => String(nick ?? '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX)

// `prefs` is { [chatId]: { star?: true, nick?: string, mute?: true } }.
const put = (prefs, id, next) => {
  const rest = { ...prefs }
  if (next.star || next.nick || next.mute) rest[id] = next
  else delete rest[id]
  return rest
}

export function withStar(prefs, id, star) {
  const cur = prefs[id] ?? {}
  return put(prefs, id, { ...cur, star: star ? true : undefined })
}

export function withMute(prefs, id, mute) {
  const cur = prefs[id] ?? {}
  return put(prefs, id, { ...cur, mute: mute ? true : undefined })
}

export function withNick(prefs, id, nick) {
  const cur = prefs[id] ?? {}
  return put(prefs, id, { ...cur, nick: clean(nick) || undefined })
}

// The conversation as Bird shows it: nickname for name, plus what the app calls them.
export function applyPrefs(chat, prefs) {
  const p = prefs[chat.id]
  return { ...chat, realName: chat.name, name: p?.nick || chat.name, starred: p?.star === true, nicked: !!p?.nick, mutedInAll: p?.mute === true }
}

// Whether a search matches a conversation by its nickname or its real name.
export const matchesQuery = (chat, q) =>
  !q || chat.name.toLowerCase().includes(q) || (chat.realName ?? '').toLowerCase().includes(q)
