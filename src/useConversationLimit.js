import { useCallback, useEffect, useState } from 'react'
import { bird } from './bird'

// How many conversations each app lists in All Chats (apps whose conversation
// list Bird reads from the page): 100 by default, or any choice up to all of
// them (null). Kept per account on this device and passed on to the desktop shell.
export const DEFAULT_CONVERSATIONS = 100
export const CONVERSATION_CHOICES = [25, 50, 100, 250, 500, null]

const storageKey = (userId) => `bird.conversationLimit.${userId}`

function load(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)))
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const out = {}
      for (const [id, v] of Object.entries(saved)) {
        if (v === null || (Number.isInteger(v) && v > 0)) out[id] = v
      }
      return out
    }
  } catch {
    /* use the defaults */
  }
  return {}
}

export function useConversationLimit(userId) {
  const [limits, setLimits] = useState(() => load(userId))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(limits))
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
    bird?.setPageLimits?.(limits)
  }, [userId, limits])

  const limitOf = useCallback(
    (id) => (id in limits ? limits[id] : DEFAULT_CONVERSATIONS),
    [limits],
  )
  const setLimit = useCallback((id, n) => setLimits((cur) => ({ ...cur, [id]: n })), [])

  return { limitOf, setLimit }
}
