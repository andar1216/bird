import { useCallback, useEffect, useState } from 'react'
import { APPS, NETWORK_ORDER, registerCustomApps } from './data'
import { bird } from './bird'
import { makeCustom } from './customApps'

// The apps in the top bar for each account: which ones are shown, in what
// order, and how many fit before "More". Kept per account on this device, next
// to that account's app logins. Hiding an app only takes it off the bar; its
// login stays.
const storageKey = (userId) => `bird.appBar.${userId}`
const customKey = (userId) => `bird.customApps.${userId}`

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

// Apps this account added itself, kept next to the bar settings.
function loadCustom(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(customKey(userId)))
    if (Array.isArray(saved)) {
      return saved
        .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.url === 'string')
        .map((c) => ({ id: c.id, name: c.name, url: c.url, hosts: Array.isArray(c.hosts) ? c.hosts : [] }))
        .slice(0, 30)
    }
  } catch {
    /* none added */
  }
  return []
}

export function useApps(userId) {
  // Registered while rendering so every component sees the added apps right away.
  const [custom, setCustom] = useState(() => {
    const list = loadCustom(userId)
    registerCustomApps(list)
    return list
  })
  const [state, setState] = useState(() => load(userId))
  const { order, limit } = state

  // Tell the desktop shell which sites the added apps may open (before the bar's apps load).
  useEffect(() => {
    bird?.setCustomApps?.(custom)
    try {
      localStorage.setItem(customKey(userId), JSON.stringify(custom))
    } catch {
      /* storage unavailable: they just won't be remembered */
    }
  }, [userId, custom])

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

  // Add a site as an app (and put it on the bar). Returns its id.
  const addCustom = useCallback((spec) => {
    const app = makeCustom(spec)
    setCustom((cur) => {
      const next = [...cur.filter((c) => c.id !== app.id), app].slice(-30)
      registerCustomApps(next)
      return next
    })
    setState((s) => (s.order.includes(app.id) ? s : { ...s, order: [...s.order, app.id] }))
    return app.id
  }, [])
  // Forget an added app (its login is wiped by the caller).
  const removeCustom = useCallback((id) => {
    setCustom((cur) => {
      const next = cur.filter((c) => c.id !== id)
      registerCustomApps(next)
      return next
    })
    setState((s) => ({ ...s, order: s.order.filter((x) => x !== id) }))
  }, [])

  return { apps: order, limit, custom, show, hide, move, setLimit, addCustom, removeCustom }
}
