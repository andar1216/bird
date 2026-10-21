// The colour theme is a choice for this device, kept until it is toggled again.
// Dark unless the user has picked light.
export const THEME_KEY = 'bird.theme'

export function loadTheme(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage unavailable: use the default */
  }
  return 'dark'
}

export function saveTheme(theme, storage = globalThis.localStorage) {
  try {
    storage?.setItem(THEME_KEY, theme)
  } catch {
    /* storage unavailable: it just won't be remembered */
  }
}
