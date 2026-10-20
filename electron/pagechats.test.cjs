const test = require('node:test')
const assert = require('node:assert/strict')
const { normalize, parseWhen, readerFor } = require('./pagechats.cjs')

const NOW = new Date('2026-10-20T16:30:00').getTime()

test('reads the times Messages shows', () => {
  assert.equal(parseWhen('4 min', NOW), NOW - 4 * 60_000)
  assert.equal(parseWhen('2 hr', NOW), NOW - 2 * 3_600_000)
  assert.equal(parseWhen('Now', NOW), NOW)
  assert.equal(new Date(parseWhen('3:13 PM', NOW)).getHours(), 15)
  assert.equal(new Date(parseWhen('3:13 PM', NOW)).getDate(), 20)
  assert.ok(parseWhen('11:59 PM', NOW) < NOW, 'a time later today is yesterday evening')
  assert.equal(parseWhen('Yesterday', NOW), NOW - 86_400_000)
  assert.equal(new Date(parseWhen('Sun', NOW)).getDay(), 0)
  assert.ok(parseWhen('Sun', NOW) < NOW)
  assert.equal(new Date(parseWhen('Oct 3', NOW)).getMonth(), 9)
  assert.equal(parseWhen('', NOW), null)
  assert.equal(parseWhen('gibberish', NOW), null)
})

test('only apps with a reader are read', () => {
  assert.ok(readerFor('messages').script.includes('mws-conversation-list-item'))
  assert.equal(readerFor('whatsapp'), null)
  assert.deepEqual(normalize('whatsapp', '[]'), [])
})

test('normalize keeps good rows, newest first, and drops junk', () => {
  const json = JSON.stringify([
    { id: 'abc', name: ' Sully ', preview: 'I might   go for a little', when: '57 min', unread: true },
    { id: 'def', name: 'Anna', preview: 'Venmo?', when: '4 min', unread: false, muted: true },
    { id: 'bad id!', name: 'x', when: '1 min' },
    { id: 'ghi', name: '', when: '1 min' },
    null,
  ])
  const items = normalize('messages', json, NOW)
  assert.deepEqual(items.map((i) => i.name), ['Anna', 'Sully'])
  assert.equal(items[0].key, 'page:def')
  assert.equal(items[0].path, '/web/conversations/def')
  assert.equal(items[0].muted, true)
  assert.equal(items[1].preview, 'I might go for a little')
  assert.equal(items[1].unread, 1)
  assert.equal(items[0].unread, 0)
})

test('normalize copes with bad data and unreadable times', () => {
  assert.deepEqual(normalize('messages', 'not json'), [])
  assert.deepEqual(normalize('messages', '{}'), [])
  const items = normalize('messages', JSON.stringify([{ id: 'a', name: 'A', when: '??' }, { id: 'b', name: 'B', when: '??' }]), NOW)
  assert.deepEqual(items.map((i) => i.name), ['A', 'B'], 'page order is kept')
})
