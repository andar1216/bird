const path = require('node:path')
const { app, BrowserWindow, WebContentsView, ipcMain, session, shell } = require('electron')
const { NETWORKS, ALLOWED_PERMISSIONS, isAllowedUrl, parseBadge } = require('./networks.cjs')

const DEV_URL = process.env.BIRD_DEV_URL // set by `npm run electron:dev`
const isDev = Boolean(DEV_URL)

/** @type {BrowserWindow | null} */
let win = null
/** @type {Map<string, { view: WebContentsView, count: number, dot: boolean }>} */
const views = new Map()
let activeId = null
// The signed-in Bird account. Each account gets its own web sessions, so one
// account's Instagram/Discord logins are never visible to another account.
let currentUserId = null
let bounds = { x: 0, y: 0, width: 0, height: 0 }

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
    }
  })

  const entry = { view, count: 0, dot: false }
  views.set(id, entry)

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
  wc.on('focus', () => {
    if (activeId !== id) focusNetwork(id)
  })

  view.setVisible(false)
  applyBounds(view)
  win.contentView.addChildView(view)
  wc.loadURL(net.url)
  sendToUI('bird:status', statusSnapshot())
  return entry
}

function destroyViews() {
  for (const { view } of views.values()) {
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
  currentUserId = id
}

function showNetwork(id) {
  // No account, no apps.
  activeId = currentUserId && id && NETWORKS[id] ? id : null
  for (const [viewId, entry] of views) entry.view.setVisible(viewId === activeId)
  if (activeId) {
    const entry = views.get(activeId) ?? createNetworkView(activeId)
    applyBounds(entry.view)
    entry.view.setVisible(true)
  }
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

  win.on('closed', () => {
    for (const { view } of views.values()) {
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
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
