import { bird } from '../bird'
import { useNow, useUsage } from '../useUsage'
import { dayStart, formatDuration, nextDayStart, totalsByApp, withLive } from '../usageStats'

// "Today 12m 04s" for one app, ticking while the app is open.
export default function AppTimer({ network }) {
  const data = useUsage(1)
  const now = useNow(1000)
  if (!bird || !data) return null

  const today = dayStart(now)
  const ms = totalsByApp(withLive(data.segments, now), today, nextDayStart(today))[network] ?? 0
  const running = data.active?.app === network

  return (
    <span className={`app-timer ${running ? 'running' : ''}`} title="Time this app has been open today">
      {running && <i aria-hidden="true" />}
      Today {formatDuration(ms)}
    </span>
  )
}
