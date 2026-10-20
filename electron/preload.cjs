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
  onStatus: (cb) => subscribe('bird:status', cb),
  // Main asks the UI to switch network (e.g. a notification was clicked).
  onActiveNetwork: (cb) => subscribe('bird:active-network', cb),
})
