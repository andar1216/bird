import { useCallback, useEffect, useState } from 'react'
import { APPS, NETWORK_ORDER } from './data'

// The apps in the top bar for each account: which ones are shown, in what
// order, and how many fit before "More". Kept per account on this device, next
// to that account's app logins. Hiding an app only takes it off the bar; its
// login stays.
const storageKey = (userId) => `bird.appBar.${userId}`
const oldKey = (userId) => `bird.apps.${userId}` // v1: just the extra apps added with "+"

export const LIMIT_CHOICES = [3, 4, 5, 6, 8, 10, null] // null = all of them
const DEFAULT_LIMIT = 6

const clean = (ids) => ids.filter((id, i) => APPS[id] && ids.indexOf(id) === i)
const validLimit = (n) => (n === null || (Number.isInteger(n) && n >= 1) ? n : DEFAULT_LIMIT)

function load(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)))
    if (saved && Array.isArray(saved.order)) {
      return { order: clean(saved.order), limit: validLimit(saved.limit) }
    }
  } catch {
    /* fall through to the defaults */
  }
  let extra = []
  try {
    const old = JSON.parse(localStorage.getItem(oldKey(userId)) ?? '[]')
    if (Array.isArray(old)) extra = old
  } catch {
    /* ignore */
  }
  return { order: clean([...NETWORK_ORDER, ...extra]), limit: DEFAULT_LIMIT }
}

export function useApps(userId) {
  const [state, setState] = useState(() => load(userId))
  const { order, limit } = state

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(state))
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, [userId, state])

  const show = useCallback(
    (id) =>
      setState((s) => (APPS[id] && !s.order.includes(id) ? { ...s, order: [...s.order, id] } : s)),
    [],
  )
  const hide = useCallback(
    (id) => setState((s) => ({ ...s, order: s.order.filter((x) => x !== id) })),
    [],
  )
  // Put `id` where `targetId` is (or last, when targetId is null).
  const move = useCallback(
    (id, targetId) =>
      setState((s) => {
        if (!s.order.includes(id) || id === targetId) return s
        const rest = s.order.filter((x) => x !== id)
        const to = targetId === null ? rest.length : s.order.indexOf(targetId)
        if (to < 0) return s
        const next = [...rest]
        next.splice(to, 0, id)
        return { ...s, order: next }
      }),
    [],
  )
  const setLimit = useCallback((n) => setState((s) => ({ ...s, limit: validLimit(n) })), [])

  return { apps: order, limit, show, hide, move, setLimit }
}
