const { contextBridge, ipcRenderer } = require('electron')

const subscribe = (channel, cb) => {
  const handler = (_event, payload) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// Small, explicit surface for the React UI. No Node access is exposed.
contextBridge.exposeInMainWorld('bird', {
  isDesktop: true,
  // Tell the shell who is signed in (user id) or out (null). Web sessions are
  // kept per account, and all web views close on sign out.
  setUser: (id) => ipcRenderer.send('bird:set-user', id),
  // Show a network's web view (or pass null to hide all, e.g. Unified mode).
  selectNetwork: (id) => ipcRenderer.send('bird:select-network', id),
  // The apps on the app bar; they load hidden in the background so their
  // notifications and unread counts arrive without opening them first.
  // Sign an app out and wipe its stored data for this Bird account.
  // Open one conversation (listed from its app's page) inside that app.
  openAppChat: (id, key) => ipcRenderer.send('bird:open-app-chat', id, key),
  // Apps that list their conversations from their pages, and how many each lists.
  getReaderApps: () => ipcRenderer.invoke('bird:reader-apps'),
  setPageLimits: (map) => ipcRenderer.send('bird:set-page-limits', map),
  setCustomApps: (list) => ipcRenderer.send('bird:set-custom-apps', list),
  unlinkApp: (id) => ipcRenderer.invoke('bird:unlink-app', id),
  setBackgroundApps: (ids) => ipcRenderer.send('bird:set-background-apps', ids),
  // An app can open in a window of its own (drag its icon out of the bar).
  detachApp: (id, x, y) => ipcRenderer.send('bird:detach-app', id, x, y),
  attachApp: (id) => ipcRenderer.send('bird:attach-app', id),
  getDetached: () => ipcRenderer.invoke('bird:get-detached'),
  onDetached: (cb) => subscribe('bird:detached', cb),
  // Rectangle (CSS px, window-relative) where the web view should be drawn.
  setBounds: (rect) => ipcRenderer.send('bird:set-bounds', rect),
  // { [networkId]: { count, dot } } for networks that have been opened.
  getStatus: () => ipcRenderer.invoke('bird:get-status'),
  // Per-app tweaks (e.g. hide Instagram Reels). Options come from the shell;
  // choices are saved per account on this device.
  getCustomizations: () => ipcRenderer.invoke('bird:get-customizations'),
  getAppPrefs: (networkId) => ipcRenderer.invoke('bird:get-app-prefs', networkId),
  setAppPref: (networkId, optionId, value) =>
    ipcRenderer.send('bird:set-app-pref', networkId, optionId, value),
  // Which apps' pages are drawn in black and white: { [appId]: boolean }.
  setGrayscale: (map) => ipcRenderer.send('bird:set-grayscale', map),
  // Screen time: this account's visits since `since` (ms) as
  // { now, segments: [{ app, start, end, live }], active: { app, start } | null }.
  getUsage: (since) => ipcRenderer.invoke('bird:get-usage', since),
  recordOpen: (appId, via) => ipcRenderer.send('bird:record-open', appId, via),
  // Conversations seen through the apps' notifications:
  // [{ app, key, name, preview, at, unread }], newest first.
  getInbox: () => ipcRenderer.invoke('bird:get-inbox'),
  markInboxRead: (key) => ipcRenderer.send('bird:inbox-read', key),
  clearInbox: () => ipcRenderer.send('bird:inbox-clear'),
  onInbox: (cb) => subscribe('bird:inbox', cb),
  // Apps whose conversation lists are still being read for the first time.
  getListing: () => ipcRenderer.invoke('bird:get-listing'),
  onListing: (cb) => subscribe('bird:listing', cb),
  onStatus: (cb) => subscribe('bird:status', cb),
  // Main asks the UI to switch network (e.g. a notification was clicked).
  onActiveNetwork: (cb) => subscribe('bird:active-network', cb),
})
