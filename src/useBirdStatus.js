import { useEffect, useState } from 'react'
import { bird } from './bird'

// Unread state per web app, reported by the desktop shell: { [networkId]: { count, dot } }.
export function useBirdStatus() {
  const [status, setStatus] = useState({})

  useEffect(() => {
    if (!bird) return undefined
    bird.getStatus().then(setStatus)
    return bird.onStatus(setStatus)
  }, [])

  return status
}
