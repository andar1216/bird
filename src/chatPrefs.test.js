import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPrefs, matchesQuery, withMute, withNick, withStar } from './chatPrefs.js'

test('a starred conversation is marked and can be unstarred', () => {
  let prefs = withStar({}, 'a', true)
  assert.equal(applyPrefs({ id: 'a', name: 'Ann' }, prefs).starred, true)
  assert.equal(applyPrefs({ id: 'b', name: 'Bo' }, prefs).starred, false)
  prefs = withStar(prefs, 'a', false)
  assert.deepEqual(prefs, {})
})

test('a nickname replaces the name but keeps the real one', () => {
  const prefs = withNick({}, 'a', '  Annie   B  ')
  const chat = applyPrefs({ id: 'a', name: 'Ann Baker' }, prefs)
  assert.equal(chat.name, 'Annie B')
  assert.equal(chat.realName, 'Ann Baker')
})

test('an empty nickname goes back to the real name and a star survives it', () => {
  let prefs = withStar(withNick({}, 'a', 'Annie'), 'a', true)
  prefs = withNick(prefs, 'a', '   ')
  assert.deepEqual(prefs, { a: { star: true, nick: undefined } })
  assert.equal(applyPrefs({ id: 'a', name: 'Ann' }, prefs).name, 'Ann')
})

test('search finds a conversation by nickname or real name', () => {
  const chat = applyPrefs({ id: 'a', name: 'Ann Baker' }, withNick({}, 'a', 'Mom'))
  assert.equal(matchesQuery(chat, 'mom'), true)
  assert.equal(matchesQuery(chat, 'baker'), true)
  assert.equal(matchesQuery(chat, 'zed'), false)
  assert.equal(matchesQuery(chat, ''), true)
})

test('a muted conversation is marked, and muting leaves star and nickname alone', () => {
  let prefs = withNick(withStar({}, 'a', true), 'a', 'Annie')
  prefs = withMute(prefs, 'a', true)
  const chat = applyPrefs({ id: 'a', name: 'Ann' }, prefs)
  assert.equal(chat.mutedInAll, true)
  assert.equal(chat.starred, true)
  assert.equal(chat.name, 'Annie')
  assert.equal(applyPrefs({ id: 'b', name: 'Bo' }, prefs).mutedInAll, false)
  assert.deepEqual(withMute(withMute({}, 'a', true), 'a', false), {})
})
