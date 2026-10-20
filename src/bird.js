// Bridge to the Electron main process (see electron/preload.cjs).
// `null` when running in a plain browser, e.g. `npm run dev`.
export const bird = typeof window !== 'undefined' ? (window.bird ?? null) : null
