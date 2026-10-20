// Recent conversations read from an app's own page (its conversation list), for
// apps that don't raise notifications Bird can see. Only names, previews and
// times already on screen are read; nothing is sent anywhere or written to disk.
//
// This depends on how the page is built, so it can stop working when the app
// changes. Each reader runs inside the app's web page and returns JSON.

const MAX_ITEMS = 12
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

// Google Messages for web: the list is <mws-conversation-list-item> elements,
// each with a link to /web/conversations/<id>.
const MESSAGES_READER = `(() => {
  const out = []
  for (const li of document.querySelectorAll('mws-conversation-list-item')) {
    const a = li.querySelector('a.list-item')
    const m = (a && a.getAttribute('href') || '').match(/^\\/web\\/conversations\\/([^/?#]+)/)
    if (!m) continue
    const name = li.querySelector('[data-e2e-conversation-name]')
    if (!name || !name.textContent.trim()) continue
    const snippet = li.querySelector('[data-e2e-conversation-snippet]')
    const when = li.querySelector('mws-relative-timestamp')
    out.push({
      id: m[1],
      name: name.textContent,
      preview: snippet ? snippet.innerText : '',
      when: when ? when.textContent : '',
      unread: a.getAttribute('data-e2e-is-unread') === 'true' || !!li.querySelector('.text-content.unread'),
      muted: a.getAttribute('data-e2e-is-muted') === 'true',
    })
    if (out.length >= ${MAX_ITEMS * 2}) break
  }
  return JSON.stringify(out)
})()`

const READERS = {
  messages: { script: MESSAGES_READER, pathPrefix: '/web/conversations/' },
  instagram: { url: 'https://www.instagram.com/direct/inbox/', script: 'JSON.stringify([])', pathPrefix: '/direct/t/' },
}

const readerFor = (app) => READERS[app] ?? null

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// "4 min", "3:13 PM", "Yesterday", "Mon", "Oct 3" -> epoch ms, or null if unknown.
function parseWhen(text, now = Date.now()) {
  const t = clip(text, 40).toLowerCase()
  if (!t) return null
  if (t === 'now' || t === 'just now') return now
  let m = t.match(/^(\d+)\s*(s|sec|secs|second|seconds)$/)
  if (m) return now - Number(m[1]) * 1000
  m = t.match(/^(\d+)\s*(m|min|mins|minute|minutes)$/)
  if (m) return now - Number(m[1]) * 60_000
  m = t.match(/^(\d+)\s*(h|hr|hrs|hour|hours)$/)
  if (m) return now - Number(m[1]) * 3_600_000
  m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/)
  if (m) {
    let hours = Number(m[1]) % 12
    if (m[3] === 'pm') hours += 12
    else if (!m[3]) hours = Number(m[1])
    const d = new Date(now)
    d.setHours(hours, Number(m[2]), 0, 0)
    return d.getTime() > now ? d.getTime() - 86_400_000 : d.getTime()
  }
  if (t === 'yesterday') return now - 86_400_000
  const dayIndex = WEEKDAYS.indexOf(t.slice(0, 3))
  if (dayIndex >= 0 && /^[a-z]+$/.test(t)) {
    const d = new Date(now)
    d.setHours(12, 0, 0, 0)
    let back = (d.getDay() - dayIndex + 7) % 7
    if (back === 0) back = 7
    return d.getTime() - back * 86_400_000
  }
  m = t.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})$/)
  if (m && MONTHS.includes(m[1])) {
    const d = new Date(now)
    d.setMonth(MONTHS.indexOf(m[1]), Number(m[2]))
    d.setHours(12, 0, 0, 0)
    return d.getTime() > now ? d.setFullYear(d.getFullYear() - 1) : d.getTime()
  }
  const parsed = Date.parse(t)
  return Number.isFinite(parsed) ? parsed : null
}

// Turn what a reader returned into list items. Unknown or malformed rows are dropped.
// Times come from the page's own labels; when one can't be read, the row keeps the
// page's order (which is newest first) just below the one before it.
function normalize(app, json, now = Date.now()) {
  const reader = readerFor(app)
  if (!reader) return []
  let raw
  try {
    raw = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const items = []
  raw.forEach((r, index) => {
    if (!r || typeof r.id !== 'string' || !/^[\w-]{1,120}$/.test(r.id)) return
    const name = clip(r.name, 80)
    if (!name) return
    const at = parseWhen(r.when, now) ?? now - 7 * 86_400_000 - index * 1000
    items.push({
      app,
      key: `page:${r.id}`,
      path: `${reader.pathPrefix}${r.id}`,
      name,
      preview: clip(r.preview, 160),
      at,
      unread: r.unread ? 1 : 0,
      muted: r.muted === true,
    })
  })
  return items.sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS)
}

module.exports = { readerFor, parseWhen, normalize, MAX_ITEMS }
