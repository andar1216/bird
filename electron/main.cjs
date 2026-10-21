const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, WebContentsView, ipcMain, powerMonitor, session, shell } = require('electron')
const { NETWORKS, ALLOWED_PERMISSIONS, isAllowedUrl, parseBadge, setCustomNetworks } = require('./networks.cjs')
const custom = require('./customizations.cjs')
const { createUsageTracker } = require('./usage.cjs')
const { createInbox, hookScript, parseReport } = require('./inbox.cjs')
const { readerFor, readerApps, normalize, limitOf, scrollScript } = require('./pagechats.cjs')

const DEV_URL = process.env.BIRD_DEV_URL // set by `npm run electron:dev`
const isDev = Boolean(DEV_URL)

/** @type {BrowserWindow | null} */
let win = null
/** @type {Map<string, { view: WebContentsView, count: number, dot: boolean, cssKey: string | null }>} */
const views = new Map()
let activeId = null
// The signed-in Bird account. Each account gets its own web sessions, so one
// account's Instagram/Discord logins are never visible to another account.
let currentUserId = null
let bounds = { x: 0, y: 0, width: 0, height: 0 }

// ------------------------------------------------------- per-app tweaks
// Saved on this device, per Bird account: { [userId]: { [networkId]: { [optionId]: true } } }.
let allPrefs = {}
const prefsPath = () => path.join(app.getPath('userData'), 'app-prefs.json')

function loadPrefs() {
  try {
    allPrefs = JSON.parse(fs.readFileSync(prefsPath(), 'utf8'))
  } catch {
    allPrefs = {}
  }
}

function savePrefs() {
  try {
    fs.writeFileSync(prefsPath(), JSON.stringify(allPrefs, null, 2))
  } catch (err) {
    console.error('[prefs] could not save', err)
  }
}

const prefsFor = (networkId) => allPrefs[currentUserId]?.[networkId] ?? {}

// ---------------------------------------------------------------- helpers
function sendToUI(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function statusSnapshot() {
  const out = {}
  for (const [id, v] of views) out[id] = { count: v.count, dot: v.dot }
  return out
}

function openExternal(url) {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString())
  } catch {
    /* ignore malformed URLs */
  }
}

// Present as a regular Chrome browser: some sites refuse to load or sign in
// when the user agent advertises Electron or the app name.
function browserUserAgent() {
  const strip = new RegExp(`\\s(?:Electron|${app.getName()})\\/\\S+`, 'gi')
  return session.defaultSession.getUserAgent().replace(strip, '')
}

// Write every open app's cookies and page storage to disk right now. Chromium
// normally batches these writes, so a login made shortly before the app is
// closed or force-killed could otherwise be lost (you'd be signed out again).
function flushAllStorage() {
  for (const { view } of views.values()) {
    const wc = view.webContents
    if (wc.isDestroyed()) continue
    wc.session.cookies.flushStore().catch(() => {})
    wc.session.flushStorageData()
  }
}

function applyBounds(view) {
  view.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  })
}

// ------------------------------------------------------------ network views
function lockDownSession(networkId, ses) {
  const permitted = (webContents, permission, requestingUrl) =>
    ALLOWED_PERMISSIONS.has(permission) &&
    isAllowedUrl(networkId, requestingUrl || webContents?.getURL() || '')

  ses.setPermissionRequestHandler((wc, permission, callback, details) =>
    callback(permitted(wc, permission, details?.requestingUrl)),
  )
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) =>
    permitted(wc, permission, requestingOrigin),
  )
  keepSessionCookies(ses)
}

// Cookies without an expiry are "session cookies": Chromium throws them away
// whenever the app closes, which signs you out of any site that keeps its login
// in one. Give them a 90-day expiry so they survive restarts, like "remember me".
const SESSION_COOKIE_TTL_S = 90 * 24 * 60 * 60
const keptSessions = new WeakSet()

function keepSessionCookies(ses) {
  if (keptSessions.has(ses)) return
  keptSessions.add(ses)
  ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (removed || !cookie.session) return
    const host = cookie.domain.replace(/^\./, '')
    ses.cookies
      .set({
        url: `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path}`,
        name: cookie.name,
        value: cookie.value,
        ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: Math.floor(Date.now() / 1000) + SESSION_COOKIE_TTL_S,
      })
      .catch(() => {})
  })
}

// TEMPORARY diagnostics (dev only) for "Discord signs me out after restart".
// Writes names only, never values, to logs/storage-diag.log.
function logStorageDiag(id, wc, phase) {
  if (!isDev || id !== 'discord' || wc.isDestroyed()) return
  const file = path.join(__dirname, '..', 'logs', 'storage-diag.log')
  const now = Date.now() / 1000
  wc.session.cookies
    .get({})
    .then(async (cookies) => {
      let keys
      try {
        keys = await wc.executeJavaScript(
          `(() => { try { const f = document.createElement('iframe'); f.style.display = 'none';
            document.body.appendChild(f); const k = Object.keys(f.contentWindow.localStorage); f.remove(); return k }
            catch (e) { return ['error:' + e.message] } })()`,
        )
      } catch (e) {
        keys = ['error:' + e.message]
      }
      const lines = [
        `[${new Date().toISOString()}] ${phase} url=${wc.getURL().split('?')[0]}`,
        `  cookies(${cookies.length}): ` +
          cookies
            .map((c) => `${c.name}${c.session ? '(session)' : `(${Math.round((c.expirationDate - now) / 86400)}d)`}`)
            .join(', '),
        `  localStorage keys(${keys.length}): ${keys.join(', ')}`,
      ]
      fs.appendFileSync(file, lines.join('\n') + '\n')
    })
    .catch(() => {})
}

function createNetworkView(id) {
  const net = NETWORKS[id]
  const ses = session.fromPartition(`persist:u-${currentUserId}-${id}`)
  lockDownSession(id, ses)

  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      preload: path.join(__dirname, 'network-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  const wc = view.webContents
  wc.setUserAgent(browserUserAgent())

  // Stay on this network's domains; send everything else to the browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(id, url)) wc.loadURL(url)
    else openExternal(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(id, url)) {
      event.preventDefault()
      openExternal(url)
      return
    }
    // Page loads the user has switched off (e.g. Instagram Reels) just don't happen.
    if (custom.isBlocked(id, prefsFor(id), url)) {
      event.preventDefault()
      return
    }
    const to = custom.rewriteUrl(id, prefsFor(id), url)
    if (to) {
      event.preventDefault()
      wc.loadURL(to)
    }
  })

  const entry = { view, count: 0, dot: false, cssKey: null, grayKey: null, pollTimer: null, readerView: null, hold: 0 }
  views.set(id, entry)

  // Single-page apps change address without a page load; enforce the same rules.
  wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) enforceRules(id)
  })
  // Inserted CSS belongs to one document, so apply it to every new page.
  wc.on('dom-ready', () => {
    applyCss(id)
    applyGrayscale(id)
    wc.executeJavaScript(hookScript(NOTIFY_MARKER)).catch(() => {})
  })
  // New-message notifications the app raises are listed in All Chats.
  wc.on('console-message', (event, ...legacy) => {
    const report = parseReport(NOTIFY_MARKER, event.message ?? legacy[1])
    if (report) recordNotification(id, report)
  })
  wc.once('did-finish-load', () => {
    setTimeout(() => logStorageDiag(id, wc, 'start+10s'), 10_000)
    setTimeout(() => logStorageDiag(id, wc, 'start+90s'), 90_000)
  })

  // Unread state comes from the page title only (no DOM access).
  wc.on('page-title-updated', (_event, title) => {
    const { count, dot } = parseBadge(title)
    if (count !== entry.count || dot !== entry.dot) {
      entry.count = count
      entry.dot = dot
      sendToUI('bird:status', statusSnapshot())
    }
  })

  // Best effort click-to-focus: when a page asks for focus while hidden
  // (for example after a native web notification is clicked), surface it.
  // Ignore the first seconds: a page loading in the background may grab focus itself.
  const createdAt = Date.now()
  wc.on('focus', () => {
    if (activeId !== id && Date.now() - createdAt > 10_000) focusNetwork(id)
  })

  // Apps whose page lists recent conversations: read that list now and then.
  const reader = readerFor(id)
  if (reader) {
    // Some apps list conversations on a page other than the one you're on (e.g. the
    // inbox, while you start on the feed): read that from a hidden second page.
    let target = wc
    if (reader.url) {
      const rv = new WebContentsView({
        webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true },
      })
      const rwc = rv.webContents
      rwc.setUserAgent(browserUserAgent())
      rwc.setAudioMuted(true)
      rwc.setWindowOpenHandler(() => ({ action: 'deny' }))
      rwc.on('will-navigate', (event, url) => {
        if (!isAllowedUrl(id, url)) event.preventDefault()
      })
      entry.readerView = rv
      target = rwc
      setTimeout(() => {
        if (views.get(id) === entry && !rwc.isDestroyed()) rwc.loadURL(reader.url)
      }, 4_000)
    }
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const gone = () => views.get(id) !== entry || target.isDestroyed()
    let polling = false
    let reads = 0
    let fullAt = -1 // for lists that keep every row: the count at which scrolling stopped finding more
    let lastPass = 0 // for lists that keep only visible rows: when they were last read in full
    let passLimit = null
    const poll = async () => {
      if (polling || gone() || target.isLoading() || entry.hold > Date.now()) return
      polling = true
      try {
        const limit = limitOf(pageLimits[id])
        // Some lists only keep the rows on screen in the page, so rows are gathered
        // as the list is scrolled rather than read all at once.
        const found = new Map()
        const take = async () => {
          const got = normalize(id, await target.executeJavaScript(reader.script(limit)), Date.now(), limit)
          for (const { guess, ...item } of got) {
            // A row with no readable time (an open chat hides it) keeps what was known.
            const old = guess ? (pageChats.get(id) ?? []).find((o) => o.key === item.key) : null
            found.set(item.key, old ? { ...item, at: old.at, preview: old.preview, unread: old.unread } : item)
          }
        }
        await take()
        reads++
        if (found.size > 0 || reads >= 2) {
          listed.add(id)
          sendListing()
        }
        // Never move the page you are looking at.
        const seeing = target === wc && activeId === id
        let scrolled = false
        // A list that keeps only its on-screen rows takes a long scroll to read in full,
        // so that is done now and then (and when the limit changes); in between, just
        // its top rows are read and merged into what is known.
        const fullPass = reader.virtual
          ? found.size > 0 && (Date.now() - lastPass > 5 * 60_000 || passLimit !== limit)
          : found.size !== fullAt
        let complete = !seeing && (!reader.virtual || fullPass)
        if (!seeing && fullPass) {
          // Start from the top: the list may have been left scrolled down (by you, or by
          // an earlier read), and rows above that would be missed.
          if (reader.virtual) {
            await target.executeJavaScript(scrollScript(reader.rowSelector, true)).catch(() => {})
            await sleep(800)
            await take()
          }
          let stalls = 0
          for (let round = 0; round < (reader.virtual ? 80 : 25); round++) {
            if (gone() || found.size >= limit) break
            if (entry.hold > Date.now()) {
              complete = false // you opened a chat: stop moving the list
              break
            }
            const before = found.size
            scrolled = true
            const moved = await target.executeJavaScript(scrollScript(reader.rowSelector, false, reader.virtual))
            await sleep(1_200)
            await take()
            if (found.size > before) {
              stalls = 0
              continue
            }
            if (!moved || ++stalls >= 2) break
          }
          if (!reader.virtual) fullAt = found.size
          if (found.size > 0 && complete) {
            lastPass = Date.now()
            passLimit = limit
          }
          if (scrolled && !gone() && entry.hold <= Date.now()) await target.executeJavaScript(scrollScript(reader.rowSelector, true))
        }
        if (gone()) return
        // While you're looking at the page only its visible rows can be read, so keep
        // the ones already known instead of shrinking the list.
        if (!complete) for (const old of pageChats.get(id) ?? []) if (!found.has(old.key)) found.set(old.key, old)
        const items = [...found.values()].sort((a, b) => b.at - a.at).slice(0, limit)
        const same = JSON.stringify(items) === JSON.stringify(pageChats.get(id) ?? [])
        if (same) return
        if (items.length) pageChats.set(id, items)
        else pageChats.delete(id)
        sendInbox()
      } catch {
        /* the page was busy or navigating: try again next time */
      } finally {
        polling = false
      }
    }

    entry.pollTimer = setInterval(poll, 15_000)
    // A notification means something new arrived: read the list soon, not in 15s.
    entry.pollSoon = () => {
      clearTimeout(entry.pollSoonTimer)
      entry.pollSoonTimer = setTimeout(poll, 1_500)
    }
    target.on('did-finish-load', () => setTimeout(poll, 6_000))
  }

  view.setVisible(false)
  // Pages lay themselves out for their size: one with no size (nothing opened yet) would
  // list no conversations, so a hidden view gets a normal size until it is shown.
  if (bounds.width < 200 || bounds.height < 200) view.setBounds({ x: 0, y: 0, width: 1000, height: 700 })
  else applyBounds(view)
  win.contentView.addChildView(view)
  wc.loadURL(custom.startUrl(id, prefsFor(id)) ?? net.url)
  sendToUI('bird:status', statusSnapshot())
  return entry
}

// (Re)apply the user's CSS tweaks to a network's current page.
function applyCss(id) {
  const entry = views.get(id)
  if (!entry || entry.view.webContents.isDestroyed()) return
  const wc = entry.view.webContents
  if (entry.cssKey) {
    wc.removeInsertedCSS(entry.cssKey).catch(() => {})
    entry.cssKey = null
  }
  const css = custom.buildCss(id, prefsFor(id))
  if (css) {
    wc
      .insertCSS(css)
      .then((key) => {
        entry.cssKey = key
      })
      .catch(() => {})
  }
}

// Grayscale: the UI works out (default + per-app choice) which apps should be
// black and white and sends { [appId]: boolean }. Kept apart from the customize
// CSS so the two don't interfere.
let grayscaleApps = {}
const isGray = (id) => grayscaleApps[id] === true
const GRAYSCALE_CSS = 'html { filter: grayscale(1) !important; }'

function applyGrayscale(id) {
  const entry = views.get(id)
  if (!entry || entry.view.webContents.isDestroyed()) return
  const wc = entry.view.webContents
  if (entry.grayKey) {
    wc.removeInsertedCSS(entry.grayKey).catch(() => {})
    entry.grayKey = null
  }
  if (!isGray(id)) return
  wc
    .insertCSS(GRAYSCALE_CSS)
    .then((key) => {
      if (isGray(id) && !entry.grayKey) entry.grayKey = key
      else wc.removeInsertedCSS(key).catch(() => {}) // switched off (or doubled) meanwhile
    })
    .catch(() => {})
}

// If the page the user is on now is one they've switched off, leave it.
function enforceRules(id) {
  const entry = views.get(id)
  if (!entry || entry.view.webContents.isDestroyed()) return
  const wc = entry.view.webContents
  const url = wc.getURL()
  const prefs = prefsFor(id)
  if (custom.isBlocked(id, prefs, url)) {
    if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
    else wc.loadURL(custom.startUrl(id, prefs) ?? NETWORKS[id].url)
    return
  }
  const to = custom.rewriteUrl(id, prefs, url)
  if (to) wc.loadURL(to)
}

// ------------------------------------------------------------ screen time
const IDLE_AFTER_S = 5 * 60
let usage = null // created once the app is ready (needs the user data folder)

// An app counts as "open" while it is the one on screen, Bird is in front, and
// you haven't been away from the keyboard for a few minutes.
function trackUsage() {
  if (!usage) return
  const inFront = win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && win.isFocused()
  const idle = powerMonitor.getSystemIdleTime() >= IDLE_AFTER_S
  usage.set(inFront && !idle && currentUserId && activeId ? { u: currentUserId, a: activeId } : null)
}

// ------------------------------------------------------------ notifications
// Apps show new messages as web notifications; we note each one (sender and
// preview) so All Chats can list them. A random marker tags our own reports.
const NOTIFY_MARKER = `__bird_${Math.random().toString(36).slice(2)}__:`
let inbox = null // created once the app is ready
let inboxSaveTimer = null

const onScreen = (id) => id === activeId && win && !win.isDestroyed() && win.isFocused()

// Conversations read from apps' own pages (see pagechats.cjs), by app. For an app
// with page conversations those replace its notification entries, as they're fuller.
const pageChats = new Map()
// How many conversations each app lists (a number, null for all of them). Set by the UI.
let pageLimits = {}

// Apps whose conversation list is still being read for the first time (so the UI can
// say "loading" instead of "no chats"). An app counts as listed once something was
// read, or it was read twice and came up empty (not signed in, or truly none). It is
// never waited on for more than a minute.
const listed = new Set()
const listingStart = new Map()
let lastListing = ''
function listingIds() {
  const ids = []
  for (const id of new Set([...backgroundApps, ...(activeId ? [activeId] : [])])) {
    if (!readerFor(id) || listed.has(id) || !currentUserId) continue
    const since = listingStart.get(id) ?? Date.now()
    listingStart.set(id, since)
    if (Date.now() - since < 60_000) ids.push(id)
  }
  return ids
}
function sendListing() {
  const ids = listingIds()
  const key = JSON.stringify(ids)
  if (key === lastListing) return
  lastListing = key
  sendToUI('bird:listing', ids)
}

function inboxList() {
  if (!currentUserId || !inbox) return []
  const covered = new Set([...pageChats].filter(([, items]) => items.length).map(([app]) => app))
  return [...inbox.list(currentUserId).filter((x) => !covered.has(x.app)), ...[...pageChats.values()].flat()].sort(
    (a, b) => b.at - a.at,
  )
}

function sendInbox() {
  sendToUI('bird:inbox', inboxList())
}

function scheduleInboxSave() {
  inboxSaveTimer ??= setTimeout(() => {
    inboxSaveTimer = null
    inbox?.save()
  }, 2_000)
}

function recordNotification(id, report) {
  views.get(id)?.pollSoon?.()
  if (!inbox || !currentUserId) return
  if (inbox.add(currentUserId, id, report, { seen: onScreen(id) })) {
    sendInbox()
    scheduleInboxSave()
  }
}

// Stop reading an app's conversation list (and close its hidden reader page).
function disposeReader(entry) {
  clearInterval(entry.pollTimer)
  clearTimeout(entry.pollSoonTimer)
  if (entry.readerView && !entry.readerView.webContents.isDestroyed()) entry.readerView.webContents.close()
  entry.readerView = null
}

function closeView(id) {
  const entry = views.get(id)
  if (!entry) return
  disposeReader(entry)
  if (pageChats.delete(id)) sendInbox()
  listed.delete(id)
  listingStart.delete(id)
  if (!entry.view.webContents.isDestroyed()) entry.view.webContents.session.flushStorageData()
  if (win && !win.isDestroyed()) win.contentView.removeChildView(entry.view)
  if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close()
  views.delete(id)
}

// Apps are loaded in the background (hidden) as soon as they are on the app bar,
// so their notifications and unread counts arrive without opening them first.
// Opened one at a time so startup isn't a pile-up.
let backgroundApps = []
let backgroundTimer = null

function syncBackground() {
  clearTimeout(backgroundTimer)
  backgroundTimer = null
  if (!currentUserId || !win || win.isDestroyed()) return
  for (const id of [...views.keys()]) {
    if (!backgroundApps.includes(id) && id !== activeId) closeView(id)
  }
  const openNext = () => {
    backgroundTimer = null
    if (!currentUserId || !win || win.isDestroyed()) return
    const id = backgroundApps.find((a) => !views.has(a))
    if (!id) {
      sendToUI('bird:status', statusSnapshot())
      return
    }
    createNetworkView(id)
    backgroundTimer = setTimeout(openNext, 2_000)
  }
  backgroundTimer = setTimeout(openNext, 1_500)
}

function destroyViews() {
  clearTimeout(backgroundTimer)
  backgroundTimer = null
  flushAllStorage() // keep this account's logins for the next sign-in
  pageChats.clear()
  listed.clear()
  listingStart.clear()
  for (const entry of views.values()) {
    const { view } = entry
    disposeReader(entry)
    if (win && !win.isDestroyed()) win.contentView.removeChildView(view)
    if (!view.webContents.isDestroyed()) view.webContents.close()
  }
  views.clear()
  activeId = null
  sendToUI('bird:status', statusSnapshot())
}

// Called when someone signs in (id) or out (null). Closes every open web view;
// cookies stay on disk under that account's partitions, so signing back in
// brings the logins back.
function setUser(id) {
  if (id === currentUserId) return
  destroyViews()
  backgroundApps = []
  currentUserId = id
  trackUsage()
  sendInbox()
}

function showNetwork(id) {
  // No account, no apps.
  activeId = currentUserId && id && NETWORKS[id] ? id : null
  for (const [viewId, entry] of views) entry.view.setVisible(viewId === activeId)
  if (activeId) {
    const entry = views.get(activeId) ?? createNetworkView(activeId)
    // You opened it: it may now use passkeys (they are refused while it runs unseen).
    if (!entry.opened) {
      entry.opened = true
      entry.view.webContents.executeJavaScript('window.__birdPasskeys = true').catch(() => {})
    }
    applyBounds(entry.view)
    entry.view.setVisible(true)
    // Opening an app means you're seeing its messages: they no longer count as unread.
    if (inbox?.markAppRead(currentUserId, activeId)) {
      sendInbox()
      scheduleInboxSave()
    }
  }
  // An app taken off the bar stops running in the background once you leave it.
  for (const viewId of [...views.keys()]) {
    if (viewId !== activeId && !backgroundApps.includes(viewId)) closeView(viewId)
  }
  trackUsage()
}

function focusNetwork(id) {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  showNetwork(id)
  sendToUI('bird:active-network', id)
}

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    title: 'Bird',
    backgroundColor: '#14121d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // The app UI itself never navigates away or opens windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const home = DEV_URL ?? 'file://'
    if (!url.startsWith(home)) {
      event.preventDefault()
      openExternal(url)
    }
  })

  if (isDev) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  win.on('close', () => {
    flushAllStorage()
    usage?.set(null)
    usage?.save()
  })
  for (const event of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore']) win.on(event, trackUsage)
  win.on('closed', () => {
    for (const entry of views.values()) {
      const { view } = entry
      disposeReader(entry)
      if (!view.webContents.isDestroyed()) view.webContents.close()
    }
    views.clear()
    activeId = null
    win = null
  })
}

// ------------------------------------------------------------------- IPC
ipcMain.on('bird:set-user', (_event, id) => {
  // Bird user ids are Mongo ObjectIds; they end up in a partition name on disk.
  setUser(typeof id === 'string' && /^[a-f0-9]{24}$/.test(id) ? id : null)
})

// The apps on the user's app bar: keep them loaded (hidden) so notifications arrive.
ipcMain.on('bird:set-background-apps', (_event, ids) => {
  backgroundApps = Array.isArray(ids)
    ? [...new Set(ids.filter((id) => typeof id === 'string' && NETWORKS[id]))].slice(0, 30)
    : []
  syncBackground()
  sendListing()
  setTimeout(sendListing, 61_000)
})

// Unlink one app's account: sign it out and wipe what Bird stored for it (cookies,
// local data, cache) in this Bird account's session for that app. Other apps and
// other Bird accounts are untouched.
ipcMain.handle('bird:unlink-app', async (_event, id) => {
  if (!currentUserId || typeof id !== 'string' || !NETWORKS[id]) return false
  const userId = currentUserId
  const ses = session.fromPartition(`persist:u-${userId}-${id}`)
  const wasActive = activeId === id
  closeView(id)
  try {
    await ses.clearStorageData()
    await ses.clearCache()
  } catch (err) {
    console.error('[unlink] could not clear', id, err)
    return false
  }
  if (inbox?.removeApp(userId, id)) {
    sendInbox()
    scheduleInboxSave()
  }
  if (userId !== currentUserId) return true // signed out meanwhile
  // Open it again fresh (on screen if you were in it, else in the background).
  if (wasActive) showNetwork(id)
  else if (backgroundApps.includes(id)) syncBackground()
  sendToUI('bird:status', statusSnapshot())
  return true
})

// Click where a page script says (a point in the page), with real mouse input. Some
// apps ignore the clicks a script makes. Resolves true if there was somewhere to click.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function clickAt(wc, locate) {
  const pt = await wc.executeJavaScript(locate)
  if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false
  const x = Math.round(pt.x)
  const y = Math.round(pt.y)
  wc.focus()
  wc.sendInputEvent({ type: 'mouseMove', x, y })
  wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  return true
}

// Open one conversation (by the key we listed it under) inside its app.
ipcMain.on('bird:open-app-chat', (_event, id, key) => {
  const reader = typeof id === 'string' && typeof key === 'string' ? readerFor(id) : null
  const item = reader && (pageChats.get(id) ?? []).find((x) => x.key === key)
  const entry = item && views.get(id)
  if (!entry || entry.view.webContents.isDestroyed()) return
  const wc = entry.view.webContents
  if (item.path) {
    // The app links each conversation: go straight there.
    const url = new URL(item.path, NETWORKS[id].url).toString()
    if (isAllowedUrl(id, url) && wc.getURL() !== url) wc.loadURL(url)
  } else if (reader.clickScript && !reader.url) {
    // The list is on the page already: click the row with that name. Rows that are
    // scrolled out of the page don't exist, so go back to the top of the list and retry.
    // Some pages open the chat in a dead state ("You are no longer present") when it
    // is opened right after the page comes on screen. Clicking the open chat closes it
    // and clicking again opens it properly, so do that for them.
    const repair = async (triesLeft) => {
      await pause(1_500)
      if (triesLeft <= 0 || wc.isDestroyed() || !reader.staleScript) return
      const stale = await wc.executeJavaScript(reader.staleScript).catch(() => false)
      if (!stale) return
      await clickAt(wc, reader.locateScript(item.name)).catch(() => {})
      await pause(900)
      await clickAt(wc, reader.locateScript(item.name)).catch(() => {})
      repair(triesLeft - 1)
    }
    const click = (triesLeft) =>
      (reader.locateScript ? clickAt(wc, reader.locateScript(item.name)) : wc.executeJavaScript(reader.clickScript(item.name)))
        .then(async (done) => {
          if (done && reader.staleScript) repair(3)
          if (done || triesLeft <= 0 || wc.isDestroyed()) return
          await wc.executeJavaScript(scrollScript(reader.rowSelector, true)).catch(() => {})
          setTimeout(() => click(triesLeft - 1), 400)
        })
        .catch(() => {})
    // Don't let the background reader scroll the list under the click.
    entry.hold = Date.now() + 8_000
    // A real click needs the page on screen at its final size, so give it a moment.
    if (reader.locateScript) setTimeout(() => click(12), 500)
    else click(12)
  } else if (reader.clickScript && reader.url) {
    // No links: open the app's list and click the row with that name.
    const click = (triesLeft) =>
      wc
        .executeJavaScript(reader.clickScript(item.name))
        .then((done) => {
          if (!done && triesLeft > 0 && !wc.isDestroyed()) setTimeout(() => click(triesLeft - 1), 400)
        })
        .catch(() => {})
    if (wc.getURL().startsWith(reader.url)) click(0)
    else {
      wc.once('did-finish-load', () => click(20)) // keeps trying until the list shows
      wc.loadURL(reader.url)
    }
  }
})
// An app page asks (before its own scripts run) whether you have opened its app.
ipcMain.on('bird:passkeys-allowed', (event) => {
  event.returnValue = [...views.values()].some((e) => e.opened && e.view.webContents === event.sender)
})
// Apps the user added by name or address. Sent before the apps on the bar, so they
// exist by the time they are opened; anything removed has its page closed.
ipcMain.on('bird:set-custom-apps', (_event, list) => {
  for (const id of setCustomNetworks(list)) closeView(id)
})
// Which apps list their conversations from their pages, and how many to list each.
ipcMain.handle('bird:reader-apps', () => readerApps())
ipcMain.on('bird:set-page-limits', (_event, map) => {
  const next = {}
  if (map && typeof map === 'object') {
    for (const id of readerApps()) {
      const v = map[id]
      if (v === null || (Number.isInteger(v) && v > 0)) next[id] = v
    }
  }
  pageLimits = next
})

ipcMain.on('bird:select-network', (_event, id) => {
  showNetwork(typeof id === 'string' ? id : null)
})

ipcMain.on('bird:set-bounds', (_event, rect) => {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return
  bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  const entry = activeId && views.get(activeId)
  if (entry) applyBounds(entry.view)
})

ipcMain.handle('bird:get-status', () => statusSnapshot())
ipcMain.handle('bird:get-listing', () => listingIds())

ipcMain.on('bird:set-grayscale', (_event, map) => {
  if (!map || typeof map !== 'object') return
  const next = {}
  for (const id of Object.keys(NETWORKS)) next[id] = map[id] === true
  const before = grayscaleApps
  grayscaleApps = next
  for (const id of views.keys()) if (before[id] !== next[id]) applyGrayscale(id)
})

// Conversations seen through app notifications (see recordNotification).
ipcMain.handle('bird:get-inbox', () => inboxList())

ipcMain.on('bird:inbox-read', (_event, key) => {
  if (typeof key === 'string' && currentUserId && inbox?.markRead(currentUserId, key)) {
    sendInbox()
    scheduleInboxSave()
  }
})

ipcMain.on('bird:inbox-clear', () => {
  if (currentUserId && inbox?.clear(currentUserId)) {
    sendInbox()
    scheduleInboxSave()
  }
})

// Screen time for the signed-in account: visits that ended after `since` (ms).
ipcMain.handle('bird:get-usage', (_event, since) => {
  if (!usage || !currentUserId) return { now: Date.now(), segments: [], active: null }
  return usage.query(currentUserId, Number.isFinite(since) ? since : 0)
})

// Customize panel: what can be tweaked, what is on for this account, and changes.
ipcMain.handle('bird:get-customizations', () => custom.describeAll())

ipcMain.handle('bird:get-app-prefs', (_event, networkId) =>
  currentUserId && NETWORKS[networkId] ? { ...prefsFor(networkId) } : {},
)

ipcMain.on('bird:set-app-pref', (_event, networkId, optionId, value) => {
  if (!currentUserId || !NETWORKS[networkId] || !custom.hasOption(networkId, optionId)) return
  if (typeof value !== 'boolean') return
  const mine = (allPrefs[currentUserId] ??= {})
  const forNetwork = (mine[networkId] ??= {})
  if (value) forNetwork[optionId] = true
  else delete forNetwork[optionId]
  savePrefs()
  // Show the change right away in an app that is already open.
  applyCss(networkId)
  enforceRules(networkId)
})

// The dev launcher (scripts/launch.mjs) asks for a clean quit by creating this
// file, so logins are saved to disk instead of the app being force-killed.
const QUIT_FILE = process.env.BIRD_QUIT_FILE
function watchForQuitRequest() {
  if (!QUIT_FILE) return
  setInterval(() => {
    if (!fs.existsSync(QUIT_FILE)) return
    try {
      fs.unlinkSync(QUIT_FILE)
    } catch {
      /* already gone */
    }
    app.quit()
  }, 400).unref()
}

// -------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(() => {
    loadPrefs()
    usage = createUsageTracker(path.join(app.getPath('userData'), 'usage.json'))
    usage.load()
    inbox = createInbox(path.join(app.getPath('userData'), 'inbox.json'))
    inbox.load()
    createWindow()
    // Save logins and screen time often (not just on quit) so even a crash or
    // force-kill keeps them. The tick also notices when you go idle.
    setInterval(() => {
      flushAllStorage()
      trackUsage()
      usage.save()
    }, 15_000).unref()
    app.on('before-quit', () => {
      flushAllStorage()
      usage.set(null)
      usage.save()
      inbox.save()
    })
    watchForQuitRequest()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
