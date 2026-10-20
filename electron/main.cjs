const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, WebContentsView, ipcMain, powerMonitor, session, shell } = require('electron')
const { NETWORKS, ALLOWED_PERMISSIONS, isAllowedUrl, parseBadge } = require('./networks.cjs')
const custom = require('./customizations.cjs')
const { createUsageTracker } = require('./usage.cjs')
const { createInbox, hookScript, parseReport } = require('./inbox.cjs')
const { readerFor, normalize } = require('./pagechats.cjs')

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

// TEMPORARY diagnostics (dev only): the shape (not the text) of Instagram's inbox
// list, to learn how to read it. Text is replaced by its length.
function logInstagramDiag(id, wc) {
  if (!isDev || id !== 'instagram' || wc.isDestroyed()) return
  const file = path.join(__dirname, '..', 'logs', 'instagram-diag.log')
  wc.executeJavaScript(`(() => {
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.textContent.trim(); return t ? '[' + t.length + 'ch]' : '' }
      if (n.nodeType !== 1) return ''
      const tag = n.tagName.toLowerCase()
      const attrs = [...n.attributes].map((a) => a.name === 'class' ? 'class="' + a.value.slice(0, 40) + '"'
        : a.name === 'href' ? 'href="' + a.value.replace(/[0-9]{5,}/g, '..') + '"'
        : a.name === 'role' || a.name === 'aria-label' || a.name === 'dir' ? a.name + '=' + (a.name === 'aria-label' ? '(' + a.value.length + ')' : a.value) : a.name).join(' ')
      return '<' + tag + ' ' + attrs + '>' + [...n.childNodes].map(walk).join('') + '</' + tag + '>'
    }
    const roles = {}
    for (const el of document.querySelectorAll('[role]')) roles[el.getAttribute('role')] = (roles[el.getAttribute('role')] || 0) + 1
    const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace(/[0-9]{5,}/g, '..').slice(0, 40)).slice(0, 40)
    const rows = [...document.querySelectorAll('[role="button"]')]
      .filter((el) => el.innerText && el.innerText.split('\\n').filter(Boolean).length >= 3 && !el.closest('li'))
    const outline = (el) => { const d = []; let n = el; for (let i = 0; i < 7 && n; i++, n = n.parentElement) d.push(n.tagName.toLowerCase() + (n.getAttribute('role') ? '[' + n.getAttribute('role') + ']' : '')); return d.join('<') }
    const leaves = (el) => {
      const out = []
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.textContent.trim(); if (!t) continue
        out.push(t.length + ':w' + getComputedStyle(n.parentElement).fontWeight + ':' + n.parentElement.tagName.toLowerCase())
      }
      return out
    }
    return JSON.stringify({ path: location.pathname, rows: rows.length, parents: rows.slice(0, 2).map(outline),
      leaves: rows.slice(0, 6).map(leaves), first: rows[0] ? walk(rows[0]).slice(0, 4500) : null })  })()`)
    .then((out) => fs.appendFileSync(file, '[' + new Date().toISOString() + '] ' + out + '\n'))
    .catch((e) => fs.appendFileSync(file, 'error ' + e.message + '\n'))
}
function createNetworkView(id) {
  const net = NETWORKS[id]
  const ses = session.fromPartition(`persist:u-${currentUserId}-${id}`)
  lockDownSession(id, ses)

  const view = new WebContentsView({
    webPreferences: {
      session: ses,
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

  const entry = { view, count: 0, dot: false, cssKey: null, grayKey: null, pollTimer: null, readerView: null }
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
      rwc.once('did-finish-load', () => setTimeout(() => logInstagramDiag(id, rwc), 40_000)) // TEMPORARY
    }
    const poll = () => {
      if (views.get(id) !== entry || target.isDestroyed() || target.isLoading()) return
      target.executeJavaScript(reader.script)
        .then((json) => {
          if (views.get(id) !== entry) return
          const next = normalize(id, json)
          const same = JSON.stringify(next) === JSON.stringify(pageChats.get(id) ?? [])
          if (same) return
          if (next.length) pageChats.set(id, next)
          else pageChats.delete(id)
          sendInbox()
        })
        .catch(() => {})
    }
    entry.pollTimer = setInterval(poll, 15_000)
    target.on('did-finish-load', () => setTimeout(poll, 6_000))
  }

  view.setVisible(false)
  applyBounds(view)
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
  if (!inbox || !currentUserId) return
  if (inbox.add(currentUserId, id, report, { seen: onScreen(id) })) {
    sendInbox()
    scheduleInboxSave()
  }
}

// Stop reading an app's conversation list (and close its hidden reader page).
function disposeReader(entry) {
  clearInterval(entry.pollTimer)
  if (entry.readerView && !entry.readerView.webContents.isDestroyed()) entry.readerView.webContents.close()
  entry.readerView = null
}

function closeView(id) {
  const entry = views.get(id)
  if (!entry) return
  disposeReader(entry)
  if (pageChats.delete(id)) sendInbox()
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

// Open one conversation inside its app (a path the app's reader produced).
ipcMain.on('bird:open-app-chat', (_event, id, chatPath) => {
  const reader = typeof id === 'string' ? readerFor(id) : null
  if (!reader || typeof chatPath !== 'string' || !/^[\w/-]{1,200}$/.test(chatPath)) return
  if (!chatPath.startsWith(reader.pathPrefix)) return
  const entry = views.get(id)
  if (!entry || entry.view.webContents.isDestroyed()) return
  const url = new URL(chatPath, NETWORKS[id].url).toString()
  if (isAllowedUrl(id, url) && entry.view.webContents.getURL() !== url) entry.view.webContents.loadURL(url)
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
