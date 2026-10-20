import { useCallback, useEffect, useMemo, useState } from 'react'
import { hiddenIds, markFor } from './hiddenChats'

// Conversations hidden from All Chats, per account on this device. See hiddenChats.js
// for when one comes back.
const storageKey = (userId) => `bird.hiddenChats.${userId}`

function load(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)))
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved
  } catch {
    /* start with none hidden */
  }
  return {}
}

export function useHiddenChats(userId, chats) {
  const [marks, setMarks] = useState(() => load(userId))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(marks))
    } catch {
      /* storage unavailable: it just won't be remembered */
    }
  }, [userId, marks])

  const hidden = useMemo(() => hiddenIds(chats, marks), [chats, marks])
  const hide = useCallback((chat) => setMarks((cur) => ({ ...cur, [chat.id]: markFor(chat) })), [])
  const unhide = useCallback(
    (id) =>
      setMarks((cur) => {
        const rest = { ...cur }
        delete rest[id]
        return rest
      }),
    [],
  )

  return { hidden, hide, unhide }
}
