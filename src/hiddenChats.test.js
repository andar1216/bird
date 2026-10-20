import test from 'node:test'
import assert from 'node:assert/strict'
import { hasNewActivity, hiddenIds, markFor } from './hiddenChats.js'

const at = (min) => new Date(Date.UTC(2026, 9, 20, 12, 0) + min * 60_000).toISOString()
const chat = (over = {}) => ({
  id: 'c1',
  lastMessageAt: at(0),
  lastMessage: { from: 'them', type: 'text', text: 'hey' },
  unread: 0,
  ...over,
})

test('a hidden conversation stays hidden while nothing happens', () => {
  const c = chat()
  const marks = { c1: markFor(c) }
  assert.deepEqual([...hiddenIds([c], marks)], ['c1'])
  assert.deepEqual([...hiddenIds([{ ...c }], marks)], ['c1'])
})

test('it comes back when they write again', () => {
  const c = chat()
  const marks = { c1: markFor(c) }
  const reply = chat({ lastMessageAt: at(5), lastMessage: { from: 'them', type: 'text', text: 'you there?' }, unread: 1 })
  assert.equal(hiddenIds([reply], marks).size, 0)
})

test('it comes back when you write to them again', () => {
  const c = chat()
  const marks = { c1: markFor(c) }
  const mine = chat({ lastMessageAt: at(1), lastMessage: { from: 'me', type: 'text', text: 'sorry, missed this' } })
  assert.equal(hasNewActivity(mine, marks.c1), true)
})

test('a new message with the same words still counts when the time is exact', () => {
  const c = chat()
  assert.equal(hasNewActivity(chat({ lastMessageAt: at(1) }), markFor(c)), true)
})

test('rough times from an app page do not bring it back by themselves', () => {
  const c = chat({ fromApp: true })
  const mark = markFor(c)
  // "4 min" read a minute later puts the time a minute off
  assert.equal(hasNewActivity(chat({ fromApp: true, lastMessageAt: at(1) }), mark), false)
  // but new words do
  const next = chat({ fromApp: true, lastMessageAt: at(1), lastMessage: { from: 'them', type: 'text', text: 'new' } })
  assert.equal(hasNewActivity(next, mark), true)
  // and so does a clearly later time
  assert.equal(hasNewActivity(chat({ fromApp: true, lastMessageAt: at(10) }), mark), true)
})

test('a "typing…" preview is not new activity', () => {
  const c = chat({ fromApp: true })
  const typing = chat({ fromApp: true, lastMessage: { from: 'them', type: 'text', text: 'typing…' } })
  assert.equal(hasNewActivity(typing, markFor(c)), false)
})

test('more unread than when hidden brings it back', () => {
  const c = chat({ unread: 1 })
  assert.equal(hasNewActivity(chat({ unread: 2 }), markFor(c)), true)
  assert.equal(hasNewActivity(chat({ unread: 0 }), markFor(c)), false)
})

test('conversations that were never hidden are not hidden', () => {
  assert.equal(hiddenIds([chat()], {}).size, 0)
})
