const fs = require('node:fs')
const path = require('node:path')

// Conversations seen through the apps' own notifications, one entry per sender
// per app. Only what an app chose to show in a notification (name and a preview)
// is kept, on this device, per Bird account. Not a full message history.
const MAX_PER_USER = 200
const DUPLICATE_WINDOW_MS = 2_000
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

function createInbox(file) {
  /** @type {{u: string, a: string, key: string, name: string, preview: string, at: number, unread: number}[]} */
  let items = []

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      items = (Array.isArray(raw) ? raw : []).filter(
        (x) =>
          x &&
          typeof x.u === 'string' &&
          typeof x.a === 'string' &&
          typeof x.key === 'string' &&
          typeof x.name === 'string' &&
          Number.isFinite(x.at),
      )
    } catch {
      items = []
    }
  }

  function save() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(items))
      fs.renameSync(tmp, file)
    } catch (err) {
      console.error('[inbox] could not save', err)
    }
  }

  // Record one notification. `seen` means the app was on screen, so it counts as read.
  // Returns true when the list changed.
  function add(userId, app, { title, body }, { seen = false, now = Date.now() } = {}) {
    const name = clip(title, 80)
    if (!name) return false
    const preview = clip(body, 160)
    const key = `${app}:${name.toLowerCase()}`
    const hit = items.find((x) => x.u === userId && x.key === key)
    if (hit) {
      if (hit.preview === preview && now - hit.at < DUPLICATE_WINDOW_MS) return false
      hit.preview = preview
      hit.at = now
      if (!seen) hit.unread += 1
    } else {
      items.push({ u: userId, a: app, key, name, preview, at: now, unread: seen ? 0 : 1 })
      const mine = items.filter((x) => x.u === userId).sort((a, b) => b.at - a.at)
      for (const old of mine.slice(MAX_PER_USER)) items.splice(items.indexOf(old), 1)
    }
    return true
  }

  const list = (userId) =>
    items
      .filter((x) => x.u === userId)
      .sort((a, b) => b.at - a.at)
      .map(({ a, key, name, preview, at, unread }) => ({ app: a, key, name, preview, at, unread }))

  function markRead(userId, key) {
    const hit = items.find((x) => x.u === userId && x.key === key)
    if (!hit || hit.unread === 0) return false
    hit.unread = 0
    return true
  }

  function markAppRead(userId, app) {
    let changed = false
    for (const x of items) {
      if (x.u === userId && x.a === app && x.unread > 0) {
        x.unread = 0
        changed = true
      }
    }
    return changed
  }

  function remove(userId, key) {
    const before = items.length
    items = items.filter((x) => !(x.u === userId && x.key === key))
    return items.length !== before
  }

  // Forget everything seen from one app (when its account is unlinked).
  function removeApp(userId, app) {
    const before = items.length
    items = items.filter((x) => !(x.u === userId && x.a === app))
    return items.length !== before
  }

  function clear(userId) {
    const before = items.length
    items = items.filter((x) => x.u !== userId)
    return items.length !== before
  }

  return { load, save, add, list, markRead, markAppRead, remove, removeApp, clear }
}

// A page only says whether a conversation is unread (0 or 1), so its badge takes the
// count from the notifications the app raised for that conversation (matched by name).
// `read` lists notification keys that went stale (the page shows the chat read, and the
// last notification is over a minute old: it was read elsewhere), to be marked read.
const FRESH_MS = 60_000
const sameChat = (app, name) => `${app}:${String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')}`

function withNoteCounts(pageItems, notes, now = Date.now()) {
  const noteFor = new Map(notes.map((x) => [sameChat(x.app, x.name), x]))
  const read = []
  const items = pageItems.map((item) => {
    const note = noteFor.get(sameChat(item.app, item.name))
    if (!note || note.unread === 0) return item
    if (item.unread > 0) return { ...item, unread: Math.max(item.unread, note.unread) }
    if (now - note.at < FRESH_MS) return { ...item, unread: note.unread } // not on the page yet
    read.push(note.key)
    return item
  })
  return { items, read }
}

// Script run inside an app's page. It wraps the page's Notification calls so
// each one is also reported (as a console message starting with `marker`) and
// then shown as usual. It never reads anything else from the page.
function hookScript(marker) {
  return `(() => {
    if (window.__birdNotifyHook) return
    window.__birdNotifyHook = true
    const marker = ${JSON.stringify(marker)}
    const report = (title, options) => {
      try {
        console.debug(marker + JSON.stringify({
          title: String(title ?? '').slice(0, 200),
          body: String((options && options.body) ?? '').slice(0, 500),
        }))
      } catch { /* never break the page */ }
    }
    const Original = window.Notification
    if (typeof Original === 'function') {
      function BirdNotification(title, options) {
        report(title, options)
        return new Original(title, options)
      }
      BirdNotification.prototype = Original.prototype
      Object.defineProperty(BirdNotification, 'permission', { get: () => Original.permission })
      BirdNotification.requestPermission = (...a) => Original.requestPermission(...a)
      BirdNotification.maxActions = Original.maxActions
      window.Notification = BirdNotification
    }
    const proto = window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype
    if (proto && proto.showNotification) {
      const show = proto.showNotification
      proto.showNotification = function (title, options) {
        report(title, options)
        return show.call(this, title, options)
      }
    }
  })()`
}

// Pull our payload out of a page's console message, or null if it isn't ours.
function parseReport(marker, message) {
  if (typeof message !== 'string' || !message.startsWith(marker)) return null
  try {
    const { title, body } = JSON.parse(message.slice(marker.length))
    return typeof title === 'string' ? { title, body: typeof body === 'string' ? body : '' } : null
  } catch {
    return null
  }
}

module.exports = { createInbox, hookScript, parseReport, withNoteCounts, MAX_PER_USER }
