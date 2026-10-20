import { useCallback, useState } from 'react'

// Whether the list of messages (the left column) is tucked away, so the app or
// conversation beside it gets the whole window. Remembered per account on this device.
const storageKey = (userId) => `bird.listHidden.${userId}`

export function useListHidden(userId) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey(userId)) === '1'
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setHidden((cur) => {
      const next = !cur
      try {
        localStorage.setItem(storageKey(userId), next ? '1' : '0')
      } catch {
        /* storage unavailable: it just won't be remembered */
      }
      return next
    })
  }, [userId])

  return { hidden, toggle }
}
