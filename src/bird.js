// The desktop shell's bridge (see electron/preload.cjs). Undefined in a plain browser.
export const bird = typeof window !== 'undefined' ? window.bird : undefined
