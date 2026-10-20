import { useCallback, useEffect, useState } from 'react'
import { NETWORK_ORDER, WEB_APPS } from './data'

// Which extra apps (added with "+") each account has. Kept per account on this
// device, next to that account's app logins.
const storageKey = (userId) => `bird.apps.${userId}`

function load(userId) {
  try {
    const ids = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    if (!Array.isArray(ids)) return []
    return ids.filter((id, i) => WEB_APPS[id] && ids.indexOf(id) === i)
  } catch {
    return []
  }
}

export function useApps(userId) {
  const [extra, setExtra] = useState(() => load(userId))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(extra))
    } catch {
      /* storage unavailable: the list just won't persist */
    }
  }, [userId, extra])

  const add = useCallback(
    (id) => setExtra((cur) => (WEB_APPS[id] && !cur.includes(id) ? [...cur, id] : cur)),
    [],
  )
  const remove = useCallback((id) => setExtra((cur) => cur.filter((x) => x !== id)), [])

  return { apps: [...NETWORK_ORDER, ...extra], extra, add, remove }
}
