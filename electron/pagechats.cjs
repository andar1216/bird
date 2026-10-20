// Recent conversations read from an app's own page (its conversation list), for
// apps that don't raise notifications Bird can see. Only names, previews and
// times already on screen are read; nothing is sent anywhere or written to disk.
//
// This depends on how the page is built, so it can stop working when the app
// changes. Each reader runs inside the app's web page and returns JSON.

// How many conversations an app lists in All Chats: 100 unless changed, up to this many.
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000
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
    if (out.length >= __MAX__) break
  }
  return JSON.stringify(out)
})()`

// Instagram's inbox (the page you start on may be the feed, so it is read from a
// hidden second page). Rows are role=button blocks holding the name (span[title]),
// a preview, a "·" and the age (abbr); they carry no link or id, so a row is
// identified by its name and opened by clicking it.
const INSTAGRAM_READER = `(() => {
  const out = []
  const seen = new Set()
  for (const row of document.querySelectorAll('[role="button"]')) {
    if (row.closest('li')) continue
    const nameEl = row.querySelector('span[title]')
    const timeEl = row.querySelector('abbr[aria-label]')
    if (!nameEl || !timeEl) continue
    const name = (nameEl.getAttribute('title') || nameEl.textContent || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const texts = []
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim()
      if (t) texts.push({ t, el: n.parentElement })
    }
    const dot = texts.map((x) => x.t).lastIndexOf('\\u00b7')
    const previewPart = dot > 0 && texts[dot - 1].t !== name ? texts[dot - 1] : null
    out.push({
      id: name,
      name,
      preview: previewPart ? previewPart.t : '',
      when: timeEl.textContent,
      unread: !!previewPart && Number(getComputedStyle(previewPart.el).fontWeight) >= 600,
      muted: false,
    })
    if (out.length >= __MAX__) break
  }
  return JSON.stringify(out)
})()`

const instagramClick = (name) => `(() => {
  const wanted = ${JSON.stringify(String(name))}
  for (const row of document.querySelectorAll('[role="button"]')) {
    if (row.closest('li')) continue
    const el = row.querySelector('span[title]')
    if (el && (el.getAttribute('title') || el.textContent || '').trim() === wanted) { row.click(); return true }
  }
  return false
})()`

// WhatsApp Web: the chat list lives in #pane-side as rows (role=row or listitem)
// holding the chat name (span[title]), a time ("10:32", "Yesterday", "Monday",
// "10/12/2026"), the last message, and an "unread" label on the badge. Rows have
// no link or id, so a chat is identified by its name and opened by clicking it.
// Only the rows on screen exist in the page, so the list is scrolled to read more.
const WHATSAPP_ROWS = `(() => {
  const pane = document.querySelector('#pane-side')
  if (!pane) return []
  const all = [...pane.querySelectorAll('[role="listitem"], [role="row"]')].filter((r) => r.querySelector('span[title]'))
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
})()`

const WHATSAPP_READER = `(() => {
  const rows = ${WHATSAPP_ROWS}
  const TIME = /^(\\d{1,2}:\\d{2}(\\s?[ap]m)?|today|yesterday|(mon|tues|wednes|thurs|fri|satur|sun)day|\\d{1,4}[\\/.-]\\d{1,2}[\\/.-]\\d{1,4})$/i
  const out = []
  const seen = new Set()
  for (const row of rows) {
    const nameEl = row.querySelector('span[title]')
    const name = (nameEl.getAttribute('title') || nameEl.textContent || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const badge = row.querySelector('[aria-label*="unread" i]')
    const badgeText = badge ? badge.textContent.trim() : ''
    const texts = []
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim()
      if (!t || nameEl.contains(n) || (badge && badge.contains(n))) continue
      // Status icons (ticks, photo, key...) put their names in the page as text.
      if (/^(wds-)?ic-[\\w-]+$/i.test(t)) continue
      texts.push(t)
    }
    const rest = texts
    const when = rest.find((t) => TIME.test(t)) || ''
    const preview = rest.filter((t) => t !== when && t !== badgeText).join(' ')
    out.push({
      id: name,
      name,
      preview,
      when,
      unread: !!badge,
      muted: !!row.querySelector('[data-icon="muted"], [aria-label="Muted" i]'),
    })
    if (out.length >= __MAX__) break
  }
  return JSON.stringify(out)
})()`

const whatsappClick = (name) => `(() => {
  const wanted = ${JSON.stringify(String(name))}
  const rows = ${WHATSAPP_ROWS}
  for (const row of rows) {
    const el = row.querySelector('span[title]')
    if (!el || (el.getAttribute('title') || el.textContent || '').trim() !== wanted) continue
    const target = row.querySelector('[role="gridcell"]') || row
    for (const type of ['mousedown', 'mouseup', 'click']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    }
    return true
  }
  return false
})()`
// Snapchat for web: the list is a react-virtualized list (aria-label "Friends Feed")
// of role=listitem rows. Each row's button names its parts through aria-labelledby
// ("title-<id> ... status-<id>"), so the person's id, name, a status line ("Delivered",
// "Received", "New Chats and Snaps"...) and an ISO time (<time datetime>) are all
// readable. Snapchat shows no message text here, so the status is the preview.
const SNAPCHAT_ROWS = `[aria-label="Friends Feed"] [role="listitem"]`

const SNAPCHAT_READER = `(() => {
  const out = []
  const seen = new Set()
  for (const row of document.querySelectorAll(${JSON.stringify(SNAPCHAT_ROWS)})) {
    const button = row.querySelector('[role="button"][aria-labelledby]')
    if (!button) continue
    const titleId = (button.getAttribute('aria-labelledby') || '').split(/\\s+/).find((s) => s.startsWith('title-'))
    if (!titleId) continue
    const nameEl = document.getElementById(titleId)
    const name = nameEl ? nameEl.textContent.trim() : ''
    const id = titleId.slice(6)
    if (!name || !id || seen.has(id)) continue
    seen.add(id)
    const statusEl = row.querySelector('[id^="status-"]')
    const timeEl = row.querySelector('time')
    const status = statusEl ? statusEl.textContent.trim() : ''
    out.push({
      id,
      name,
      preview: status,
      when: timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent) : '',
      unread: /^(new|received)/i.test(status),
      muted: false,
    })
    if (out.length >= __MAX__) break
  }
  return JSON.stringify(out)
})()`

const snapchatClick = (name) => `(() => {
  const wanted = ${JSON.stringify(String(name))}
  for (const row of document.querySelectorAll(${JSON.stringify(SNAPCHAT_ROWS)})) {
    const button = row.querySelector('[role="button"][aria-labelledby]')
    const titleId = button && (button.getAttribute('aria-labelledby') || '').split(/\\s+/).find((s) => s.startsWith('title-'))
    const el = titleId && document.getElementById(titleId)
    if (!el || el.textContent.trim() !== wanted) continue
    for (const type of ['mousedown', 'mouseup', 'click']) {
      button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    }
    return true
  }
  return false
})()`
const READERS = {
  messages: {
    script: (max) => MESSAGES_READER.replace('__MAX__', String(max)),
    rowSelector: 'mws-conversation-list-item',
    pathPrefix: '/web/conversations/',
  },
  whatsapp: {
    script: (max) => WHATSAPP_READER.replace('__MAX__', String(max)),
    rowSelector: '#pane-side [role="row"], #pane-side [role="listitem"]',
    virtual: true,
    clickScript: (name) => whatsappClick(name),
  },
  snapchat: {
    script: (max) => SNAPCHAT_READER.replace('__MAX__', String(max)),
    rowSelector: SNAPCHAT_ROWS,
    virtual: true,
    clickScript: snapchatClick,
  },
  instagram: {
    url: 'https://www.instagram.com/direct/inbox/',
    script: (max) => INSTAGRAM_READER.replace('__MAX__', String(max)),
    rowSelector: 'abbr[aria-label]',
    clickScript: instagramClick,
  },
}

const readerFor = (app) => READERS[app] ?? null
const readerApps = () => Object.keys(READERS)

// A saved limit (a number, or null for "all of them") as a safe number.
function limitOf(value) {
  if (value === null) return MAX_LIMIT
  return Number.isInteger(value) && value >= 1 ? Math.min(value, MAX_LIMIT) : DEFAULT_LIMIT
}

// Lists load as you scroll, so to read more than the first screenful the page's
// list is scrolled to its end (and back to the top afterwards). `toTop` false
// scrolls down (a page at a time if yPage, for lists that only keep visible rows)\n// and says whether it moved. Finds the scrollable box around the first row.
const scrollScript = (rowSelector, toTop, byPage = false) => `(() => {
  const first = document.querySelector(${JSON.stringify(rowSelector)})
  let el = first && first.parentElement
  while (el && !(el.scrollHeight > el.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement
  if (!el) return false
  const was = el.scrollTop
  el.scrollTop = ${toTop ? '0' : byPage ? 'was + el.clientHeight * 0.85' : 'el.scrollHeight'}
  return ${toTop ? 'true' : 'el.scrollTop !== was'}
})()`

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// "4 min", "3:13 PM", "Yesterday", "Mon", "Oct 3" -> epoch ms, or null if unknown.
function parseWhen(text, now = Date.now()) {
  const t = clip(text, 40).toLowerCase()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}t/.test(t)) {
    const iso = Date.parse(t.toUpperCase())
    if (Number.isFinite(iso)) return iso
  }
  if (t === 'now' || t === 'just now') return now
  let m = t.match(/^(\d+)\s*(s|sec|secs|second|seconds)$/)
  if (m) return now - Number(m[1]) * 1000
  m = t.match(/^(\d+)\s*(m|min|mins|minute|minutes)$/)
  if (m) return now - Number(m[1]) * 60_000
  m = t.match(/^(\d+)\s*(h|hr|hrs|hour|hours)$/)
  if (m) return now - Number(m[1]) * 3_600_000
  m = t.match(/^(\d+)\s*(d|day|days)$/)
  if (m) return now - Number(m[1]) * 86_400_000
  m = t.match(/^(\d+)\s*(w|wk|wks|week|weeks)$/)
  if (m) return now - Number(m[1]) * 7 * 86_400_000
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
function normalize(app, json, now = Date.now(), limit = DEFAULT_LIMIT) {
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
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 120) return
    if (reader.pathPrefix && !/^[\w-]{1,120}$/.test(r.id)) return
    const name = clip(r.name, 80)
    if (!name) return
    const at = parseWhen(r.when, now) ?? now - 7 * 86_400_000 - index * 1000
    items.push({
      app,
      key: `page:${r.id}`,
      path: reader.pathPrefix ? `${reader.pathPrefix}${r.id}` : undefined,
      name,
      preview: clip(r.preview, 160),
      at,
      unread: r.unread ? 1 : 0,
      muted: r.muted === true,
    })
  })
  return items.sort((a, b) => b.at - a.at).slice(0, limitOf(limit))
}

module.exports = { readerFor, readerApps, parseWhen, normalize, limitOf, scrollScript, DEFAULT_LIMIT, MAX_LIMIT }
