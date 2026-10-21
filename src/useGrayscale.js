import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { bird } from './bird'
import { APPS } from './data'

// Grayscale is two separate things, each with a default for every app plus an
// optional choice per app:
//   'icon'   the app's icon (and unread badge) in Bird's own interface
//   'screen' the app's page, drawn in black and white by the desktop shell
// A per-app mode is 'default' (follow the default), 'on' (gray) or 'off' (color).
// A third, simpler choice greys the All Chats lists and Bird's own chat view (the
// people, avatars and badges there), whichever apps they come from.
// Saved per account on this device.
export const KINDS = ['icon', 'screen']
const MODES = ['default', 'on', 'off']
const storageKey = (userId) => `bird.grayscale.${userId}`

const empty = () => ({ defaults: { icon: false, screen: false }, apps: {}, chats: false })

function load(userId) {
  let raw = null
  try {
    raw = localStorage.getItem(storageKey(userId))
  } catch {
    /* storage unavailable */
  }
  if (raw === '1' || raw === '0') {
    const on = raw === '1' // the older single switch covered both
    return { defaults: { icon: on, screen: on }, apps: {} }
  }
  try {
    const saved = JSON.parse(raw ?? '{}')
    const out = empty()
    out.chats = saved.chats === true
    if (saved.defaults) for (const k of KINDS) out.defaults[k] = saved.defaults[k] === true
    else if (saved.d === true) out.defaults = { icon: true, screen: true } // previous format
    // Previous format had one mode per app, which applied to both.
    const perApp = saved.apps ?? Object.fromEntries(
      Object.entries(saved.a ?? {}).map(([id, m]) => [id, { icon: m, screen: m }]),
    )
    for (const [id, modes] of Object.entries(perApp)) {
      if (!APPS[id]) continue
      for (const k of KINDS) {
        if (modes?.[k] === 'on' || modes?.[k] === 'off') (out.apps[id] ??= {})[k] = modes[k]
      }
    }
    return out
  } catch {
    return empty()
  }
}

export function useGrayscale(userId) {
  const [state, setState] = useState(() => load(userId))

  const value = useMemo(() => {
    const modeOf = (id, kind) => state.apps[id]?.[kind] ?? 'default'
    return {
      chatsGray: state.chats,
      toggleChats: () => setState((s) => ({ ...s, chats: !s.chats })),
      defaultOn: (kind) => state.defaults[kind],
      toggleDefault: (kind) =>
        setState((s) => ({ ...s, defaults: { ...s.defaults, [kind]: !s.defaults[kind] } })),
      modeOf,
      setMode: (id, kind, mode) => {
        if (!KINDS.includes(kind) || !MODES.includes(mode)) return
        setState((s) => {
          const mine = { ...s.apps[id] }
          if (mode === 'default') delete mine[kind]
          else mine[kind] = mode
          const apps = { ...s.apps, [id]: mine }
          if (Object.keys(mine).length === 0) delete apps[id]
          return { ...s, apps }
        })
      },
      isGray: (id, kind) => {
        const mode = modeOf(id, kind)
        return mode === 'default' ? state.defaults[kind] : mode === 'on'
      },
    }
  }, [state])

  const { isGray } = value
  useEffect(() => {
    // The shell only needs to know which pages to grey.
    bird?.setGrayscale?.(Object.fromEntries(Object.keys(APPS).map((id) => [id, isGray(id, 'screen')])))
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(state))
    } catch {
      /* the choice just won't persist */
    }
  }, [userId, state, isGray])

  return value
}

export const GrayscaleContext = createContext({
  chatsGray: false,
  toggleChats: () => {},
  defaultOn: () => false,
  toggleDefault: () => {},
  modeOf: () => 'default',
  setMode: () => {},
  isGray: () => false,
})

// For any component: is this app's icon / screen gray, and what is its setting?
export const useGray = () => useContext(GrayscaleContext)
