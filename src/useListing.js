import { useEffect, useState } from 'react'
import { bird } from './bird'

// Apps whose recent conversations are still being read for the first time (after
// the app opens or refreshes), so the list can say "loading" instead of "no chats".
// Until the desktop shell answers, it counts as loading. Always false in a browser.
export function useListing() {
  const [ids, setIds] = useState(bird?.getListing ? null : [])

  useEffect(() => {
    if (!bird?.getListing) return undefined
    let live = true
    bird.getListing().then((list) => live && setIds(list)).catch(() => live && setIds([]))
    const off = bird.onListing((list) => setIds(list))
    return () => {
      live = false
      off()
    }
  }, [])

  return ids === null || ids.length > 0
}
