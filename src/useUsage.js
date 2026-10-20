import { useEffect, useState } from 'react'
import { bird } from './bird'
import { daysAgoStart } from './usageStats'

// This account's screen time for the last `days` days (today included),
// refreshed every few seconds. null until the first answer; always null in a
// plain browser, where nothing is tracked.
export function useUsage(days, pollMs = 5000) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!bird?.getUsage) return undefined
    let live = true
    const pull = () =>
      bird
        .getUsage(daysAgoStart(days - 1))
        .then((r) => live && setData(r))
        .catch(() => {})
    pull()
    const timer = setInterval(pull, pollMs)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [days, pollMs])

  return data
}

// The current time, re-read every `ms`, so live timers tick.
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}
