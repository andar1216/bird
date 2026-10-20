import { useEffect, useMemo, useState } from 'react'
import { bird } from './bird'
import { formatTime } from './format'

const PALETTE = [
  ['#ff7eb3', '#ff4d8d'],
  ['#ffb36b', '#ff7a45'],
  ['#8ee27a', '#2fbf71'],
  ['#6fe0d6', '#1fa2b8'],
  ['#7fb2ff', '#3d6bff'],
  ['#c59bff', '#8a52ff'],
]

function colorsFor(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// A conversation learned from an app's notification, shaped like a chat row so
// the sidebar can list it. Opening it opens that app (see UnifiedView).
export const INBOX_PREFIX = 'n:'

export function inboxToChat(item) {
  const at = new Date(item.at).toISOString()
  return {
    id: `${INBOX_PREFIX}${item.key}`,
    fromApp: true,
    network: item.app,
    name: item.name,
    colors: colorsFor(item.name),
    lastMessage: { from: 'them', type: 'text', text: item.preview, sentAt: at },
    lastMessageAt: at,
    time: formatTime(at),
    unread: item.unread,
    mention: false,
    muted: false,
    pinned: false,
    archived: false,
    lowPriority: false,
    typing: false,
    messages: [],
  }
}

// New-message notifications the apps raised, as chat rows. Empty in a browser.
export function useInbox() {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!bird?.getInbox) return undefined
    let live = true
    bird.getInbox().then((list) => live && setItems(list)).catch(() => {})
    const off = bird.onInbox(setItems)
    return () => {
      live = false
      off()
    }
  }, [])

  return useMemo(() => items.map(inboxToChat), [items])
}
