import { useEffect, useState } from 'react'
import { bird } from './bird'

// { [networkId]: { count, dot } } for networks opened in the desktop shell.
export function useBirdStatus() {
  const [status, setStatus] = useState({})

  useEffect(() => {
    if (!bird) return undefined
    let live = true
    bird.getStatus().then((s) => {
      if (live) setStatus(s)
    })
    const off = bird.onStatus(setStatus)
    return () => {
      live = false
      off()
    }
  }, [])

  return status
}
