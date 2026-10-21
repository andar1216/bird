const test = require('node:test')
const assert = require('node:assert/strict')
const { normalize, parseWhen, readerFor, limitOf, scrollScript, DEFAULT_LIMIT, MAX_LIMIT } = require('./pagechats.cjs')

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
  assert.ok(readerFor('messages').script(7).includes('out.length >= 7'))
  assert.equal(readerFor('gmail'), null)
  assert.deepEqual(normalize('gmail', '[]'), [])
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

test('Instagram rows are identified by name and have no link', () => {
  const json = JSON.stringify([
    { id: 'Alex Rivera', name: 'Alex Rivera', preview: 'sounds good', when: '3m', unread: true },
    { id: 'Crew', name: 'Crew', preview: 'You: ok', when: '2h' },
  ])
  const items = normalize('instagram', json, NOW)
  assert.deepEqual(items.map((i) => i.name), ['Alex Rivera', 'Crew'])
  assert.equal(items[0].key, 'page:Alex Rivera')
  assert.equal(items[0].path, undefined)
  assert.equal(items[0].unread, 1)
  assert.equal(typeof readerFor('instagram').clickScript('A "B"'), 'string')
  assert.equal(parseWhen('2w', NOW), NOW - 14 * 86_400_000)
  assert.equal(parseWhen('3d', NOW), NOW - 3 * 86_400_000)
})

test('the per-app limit defaults to 100 and can be raised to everything', () => {
  assert.equal(DEFAULT_LIMIT, 100)
  assert.equal(limitOf(undefined), 100)
  assert.equal(limitOf(25), 25)
  assert.equal(limitOf(null), MAX_LIMIT, 'null means all of them')
  assert.equal(limitOf(-3), 100)
  assert.equal(limitOf(10 ** 9), MAX_LIMIT)
  const many = Array.from({ length: 150 }, (_, i) => ({ id: `c${i}`, name: `Person ${i}`, when: `${i + 1} min` }))
  const json = JSON.stringify(many)
  assert.equal(normalize('messages', json, NOW).length, 100)
  assert.equal(normalize('messages', json, NOW, 25).length, 25)
  assert.equal(normalize('messages', json, NOW, null).length, 150)
  assert.equal(normalize('messages', json, NOW, 25)[0].name, 'Person 0', 'newest first')
})

test('scrolling script targets the list around the first row', () => {
  assert.ok(scrollScript('mws-conversation-list-item', false).includes('el.scrollHeight'))
  assert.ok(scrollScript('abbr[aria-label]', true).includes('scrollTop = 0'))
})

test('WhatsApp chats are identified by name and have the times WhatsApp shows', () => {
  const reader = readerFor('whatsapp')
  assert.equal(reader.virtual, true)
  for (const src of [reader.script(50), reader.clickScript('Mom "M"')]) {
    assert.doesNotThrow(() => new (require('node:vm').Script)(src), 'the script is valid JavaScript')
  }
  assert.ok(reader.script(50).includes('#pane-side'))
  const json = JSON.stringify([
    { id: 'Mom', name: 'Mom', preview: 'Dinner at 7?', when: '10:32', unread: true },
    { id: 'Work group', name: 'Work group', preview: 'Sam: ok', when: 'Yesterday' },
    { id: 'Old friend', name: 'Old friend', preview: 'haha', when: '10/12/2026' },
  ])
  const items = normalize('whatsapp', json, NOW)
  assert.deepEqual(items.map((i) => i.name), ['Mom', 'Work group', 'Old friend'])
  assert.equal(items[0].key, 'page:Mom')
  assert.equal(items[0].path, undefined, 'no link: opened by clicking the row')
  assert.equal(items[0].unread, 1)
  assert.equal(new Date(items[2].at).getMonth(), 9)
  assert.equal(parseWhen('Monday', NOW) < NOW, true)
  assert.equal(new Date(parseWhen('13:05', NOW)).getHours(), 13)
})

test('the scroll scripts run and report whether the list moved', () => {
  const vm = require('node:vm')
  const list = { scrollHeight: 2000, clientHeight: 500, scrollTop: 0, parentElement: null }
  const row = { parentElement: list }
  const run = (src) =>
    vm.runInNewContext(src, {
      document: { querySelector: () => row },
      getComputedStyle: () => ({ overflowY: 'auto' }),
    })
  assert.equal(run(scrollScript('row', false)), true)
  assert.equal(list.scrollTop, 2000, 'to the end of the list')
  assert.equal(run(scrollScript('row', false)), false, 'already at the end')
  list.scrollTop = 100
  assert.equal(run(scrollScript('row', false, true)), true)
  assert.equal(list.scrollTop, 100 + 500 * 0.85, 'one page down')
  assert.equal(run(scrollScript('row', true)), true)
  assert.equal(list.scrollTop, 0)
})

test('Snapchat chats are read from the Friends Feed rows', () => {
  const vm = require('node:vm')
  const reader = readerFor('snapchat')
  assert.doesNotThrow(() => new vm.Script(reader.clickScript('A "quoted" name')))

  // A minimal stand-in for the page: one row shaped like Snapchat's.
  const text = (t) => ({ textContent: t })
  const names = { 'title-abc': text(' Tommy Welsh '), 'title-def': text('Anna') }
  const rowFor = (id, status, datetime) => ({
    querySelector(sel) {
      if (sel === '[role="button"][aria-labelledby]') {
        return { getAttribute: () => `title-${id} comma1 status-${id}`, dispatchEvent: () => true }
      }
      if (sel === '[id^="status-"]') return text(status)
      if (sel === 'time') return { getAttribute: () => datetime, textContent: '1m' }
      return null
    },
  })
  const rows = [rowFor('abc', 'Delivered', '2026-10-20T21:50:00.000Z'), rowFor('def', 'New Chats and Snaps', '2026-09-19T12:00:00.000Z')]
  const context = {
    document: { querySelectorAll: () => rows, getElementById: (id) => names[id] },
    MouseEvent: class {},
    window: {},
  }
  const json = vm.runInNewContext(reader.script(10), context)
  const items = normalize('snapchat', json, Date.parse('2026-10-20T22:00:00Z'))
  assert.deepEqual(items.map((i) => i.name), ['Tommy Welsh', 'Anna'])
  assert.equal(items[0].preview, 'Delivered')
  assert.equal(items[0].unread, 0)
  assert.equal(items[1].unread, 1, 'new chats and snaps are unread')
  assert.equal(items[0].at, Date.parse('2026-10-20T21:50:00.000Z'), 'the ISO time is used')
  assert.equal(items[0].key, 'page:abc')
  assert.equal(vm.runInNewContext(reader.clickScript('Anna'), context), true)
  assert.equal(vm.runInNewContext(reader.clickScript('Nobody'), context), false)
})

test('a row with no readable time is flagged so the shell can keep what it knew', () => {
  const json = JSON.stringify([
    { id: 'a', name: 'Ann', preview: 'Close Chat', when: '' },
    { id: 'b', name: 'Bo', preview: 'Hi', when: '5 min' },
  ])
  const [a, b] = normalize('snapchat', json, Date.parse('2026-10-20T22:00:00Z')).sort((x, y) => x.name.localeCompare(y.name))
  assert.equal(a.guess, true)
  assert.equal(b.guess, undefined)
})
