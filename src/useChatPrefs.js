import { useCallback, useEffect, useState } from 'react'
import { withNick, withStar } from './chatPrefs'

const storageKey = (userId) => `bird.chatPrefs.${userId}`

function load(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)))
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved
  } catch {
    /* start with no stars or nicknames */
  }
  return {}
}

// Stars and nicknames for this account's conversations.
export function useChatPrefs(userId) {
  const [prefs, setPrefs] = useState(() => load(userId))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
    } catch {
      /* storage unavailable: they just won't be remembered */
    }
  }, [userId, prefs])

  const toggleStar = useCallback(
    (id) => setPrefs((cur) => withStar(cur, id, cur[id]?.star !== true)),
    [],
  )
  const rename = useCallback((id, nick) => setPrefs((cur) => withNick(cur, id, nick)), [])

  return { prefs, toggleStar, rename }
}
