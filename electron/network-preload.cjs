// Runs first in every app page. Apps Bird loads in the background (so their
// notifications arrive) must not pop up system dialogs, like the Windows "Choose a
// passkey" box a sign-in page raises on its own. Passkey requests are refused until
// you open that app yourself; main.cjs says when (window.__birdPasskeys).
const { contextBridge, ipcRenderer } = require('electron')

let allowed = false
try {
  allowed = ipcRenderer.sendSync('bird:passkeys-allowed') === true
} catch {
  /* treated as not opened */
}

contextBridge.executeInMainWorld({
  func: (allowedAtStart) => {
    globalThis.__birdPasskeys = allowedAtStart
    const creds = navigator.credentials
    if (!creds) return
    for (const method of ['get', 'create']) {
      const original = creds[method]
      if (typeof original !== 'function') continue
      creds[method] = function (options) {
        // Only passkeys (WebAuthn) are held back; saved passwords etc. work as usual.
        if (options && options.publicKey && !globalThis.__birdPasskeys) {
          return Promise.reject(new DOMException('Passkeys are off until you open this app.', 'NotAllowedError'))
        }
        return original.apply(this, arguments)
      }
    }
  },
  args: [allowed],
})
