import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTheme, saveTheme, THEME_KEY } from './theme.js'

const fakeStorage = (initial = {}) => {
  const data = { ...initial }
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = String(v)), data }
}

test('the theme is dark until the user picks light', () => {
  assert.equal(loadTheme(fakeStorage()), 'dark')
  assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: 'nonsense' })), 'dark')
})

test('what the user toggled is what comes back after a restart', () => {
  const s = fakeStorage()
  saveTheme('light', s)
  assert.equal(loadTheme(s), 'light')
  saveTheme('dark', s)
  assert.equal(loadTheme(s), 'dark')
})

test('a broken storage never throws', () => {
  const broken = { getItem() { throw new Error('no') }, setItem() { throw new Error('no') } }
  assert.equal(loadTheme(broken), 'dark')
  assert.doesNotThrow(() => saveTheme('light', broken))
})
