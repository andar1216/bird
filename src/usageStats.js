// Helpers for the screen-time views. A "segment" is one visit to an app:
// { app, start, end } in epoch milliseconds (local time is used for days).

const MINUTE = 60_000

export function dayStart(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Midnight after `ts`'s day (built from the calendar, so daylight saving is fine).
export function nextDayStart(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
}

// Start of the day `n` days before today.
export function daysAgoStart(n, now = Date.now()) {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n).getTime()
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// The visit in progress keeps growing: stretch it to `now`.
export function withLive(segments, now) {
  return segments.map((s) => (s.live ? { ...s, end: Math.max(s.end, now) } : s))
}

// Milliseconds per app inside [from, to). Visits are clipped to that window.
export function totalsByApp(segments, from, to) {
  const out = {}
  for (const s of segments) {
    const ms = Math.min(s.end, to) - Math.max(s.start, from)
    if (ms > 0) out[s.app] = (out[s.app] ?? 0) + ms
  }
  return out
}

// One entry per day, oldest first, ending with today: { start, perApp, total }.
export function perDay(segments, days, now = Date.now()) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const start = daysAgoStart(i, now)
    const perApp = totalsByApp(segments, start, nextDayStart(start))
    out.push({ start, perApp, total: Object.values(perApp).reduce((a, b) => a + b, 0) })
  }
  return out
}

// Visits clipped to one day, oldest first.
export function segmentsOnDay(segments, start) {
  const end = nextDayStart(start)
  return segments
    .map((s) => ({ ...s, start: Math.max(s.start, start), end: Math.min(s.end, end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)
}

// Hours shown on the timeline: from just before the first visit to just after
// the last, never narrower than six hours.
export function timelineRange(daySegments, dayStartTs) {
  if (daySegments.length === 0) return { from: dayStartTs + 8 * 60 * MINUTE, to: dayStartTs + 20 * 60 * MINUTE }
  const first = Math.min(...daySegments.map((s) => s.start))
  const last = Math.max(...daySegments.map((s) => s.end))
  const hour = 60 * MINUTE
  const dayEnd = nextDayStart(dayStartTs)
  // Whole hours, measured from midnight so half-hour time zones line up.
  const floorHour = (t) => dayStartTs + Math.floor((t - dayStartTs) / hour) * hour
  const ceilHour = (t) => dayStartTs + Math.ceil((t - dayStartTs) / hour) * hour
  let from = floorHour(first)
  let to = Math.min(dayEnd, ceilHour(last))
  if (to - from < 6 * hour) {
    from = Math.max(dayStartTs, floorHour((from + to) / 2 - 3 * hour))
    to = Math.min(dayEnd, from + 6 * hour)
    from = Math.max(dayStartTs, to - 6 * hour)
  }
  return { from, to }
}

// Dark brand colours (X, TikTok) vanish on a dark theme; lighten those for charts.
export function chartColor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return '#7c7f93'
  const n = parseInt(m[1], 16)
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return lum < 0.2 ? '#7c7f93' : hex
}

// How many times each app was opened inside [from, to): `app` counts opens from the
// app's icon, `all` adds the ones made through its conversations in All Chats.
export function opensByApp(opens, from, to) {
  const out = {}
  for (const o of opens ?? []) {
    if (o.at < from || o.at >= to) continue
    const row = (out[o.app] ??= { app: 0, chat: 0, all: 0 })
    row[o.via === 'chat' ? 'chat' : 'app']++
    row.all++
  }
  return out
}