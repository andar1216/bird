import { useCallback, useEffect, useState } from 'react'

// Which apps' conversations appear in All Chats: everything, a few apps, or
// none. Stored as the apps that are *hidden*, so a newly added app shows up by
// default. Kept per account on this device.
const storageKey = (userId) => `bird.allChatsHidden.${userId}`

function load(userId) {
  try {
    const ids = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function useAllChatsScope(userId) {
  const [hidden, setHidden] = useState(() => load(userId))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(hidden))
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, [userId, hidden])

  const isShown = useCallback((id) => !hidden.includes(id), [hidden])
  const toggle = useCallback(
    (id) => setHidden((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [],
  )
  // Show only `ids` (all of them, or none) out of `all`.
  const setShown = useCallback(
    (all, show) => setHidden((cur) => (show ? cur.filter((x) => !all.includes(x)) : [...new Set([...cur, ...all])])),
    [],
  )

  return { hidden, isShown, toggle, setShown }
}
