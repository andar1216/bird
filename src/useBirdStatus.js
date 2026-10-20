import { useEffect, useState } from 'react'
import { bird } from './bird'

// Unread state per web app, reported by the desktop shell:
// { [networkId]: { count, dot, since } }, where `since` is when the unread
// count first appeared here (so it can be listed with a time).
export function useBirdStatus() {
  const [status, setStatus] = useState({})

  useEffect(() => {
    if (!bird) return undefined
    const update = (snapshot) =>
      setStatus((prev) => {
        const next = {}
        for (const [id, s] of Object.entries(snapshot ?? {})) {
          next[id] = { ...s, since: s.count > 0 ? (prev[id]?.since ?? Date.now()) : undefined }
        }
        return next
      })
    bird.getStatus().then(update)
    return bird.onStatus(update)
  }, [])

  return status
}
