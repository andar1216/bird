const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createInbox, hookScript, parseReport } = require('./inbox.cjs')

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bird-inbox-')), 'inbox.json')
const T0 = Date.UTC(2026, 9, 20, 12, 0, 0)

test('groups notifications by sender per app and counts unread', () => {
  const box = createInbox(tmpFile())
  box.add('me', 'discord', { title: 'Sam', body: 'hey' }, { now: T0 })
  box.add('me', 'discord', { title: 'sam', body: 'you there?' }, { now: T0 + 5_000 })
  box.add('me', 'instagram', { title: 'Sam', body: 'other app' }, { now: T0 + 6_000 })
  const list = box.list('me')
  assert.equal(list.length, 2)
  assert.deepEqual(list[0], { app: 'instagram', key: 'instagram:sam', name: 'Sam', preview: 'other app', at: T0 + 6_000, unread: 1 })
  assert.equal(list[1].unread, 2)
  assert.equal(list[1].preview, 'you there?')
})

test('ignores empty titles and the same notification fired twice at once', () => {
  const box = createInbox(tmpFile())
  assert.equal(box.add('me', 'discord', { title: '  ', body: 'x' }), false)
  assert.equal(box.add('me', 'discord', { title: 'Sam', body: 'hi' }, { now: T0 }), true)
  assert.equal(box.add('me', 'discord', { title: 'Sam', body: 'hi' }, { now: T0 + 500 }), false)
  assert.equal(box.list('me')[0].unread, 1)
})

test('messages seen on screen are not unread; opening an app clears its unread', () => {
  const box = createInbox(tmpFile())
  box.add('me', 'discord', { title: 'Sam', body: 'hi' }, { seen: true, now: T0 })
  assert.equal(box.list('me')[0].unread, 0)
  box.add('me', 'discord', { title: 'Lee', body: 'yo' }, { now: T0 + 1000 })
  box.add('me', 'x', { title: 'Kim', body: 'dm' }, { now: T0 + 2000 })
  assert.equal(box.markAppRead('me', 'discord'), true)
  assert.deepEqual(box.list('me').map((i) => i.unread), [1, 0, 0])
  assert.equal(box.markRead('me', 'x:kim'), true)
  assert.equal(box.markRead('me', 'x:kim'), false)
})

test('each account only sees its own, clear works, and data survives a restart', () => {
  const file = tmpFile()
  const box = createInbox(file)
  box.add('me', 'discord', { title: 'Sam', body: 'hi' }, { now: T0 })
  box.add('you', 'discord', { title: 'Zed', body: 'psst' }, { now: T0 })
  box.save()
  const again = createInbox(file)
  again.load()
  assert.deepEqual(again.list('me').map((i) => i.name), ['Sam'])
  assert.equal(again.clear('me'), true)
  assert.equal(again.list('me').length, 0)
  assert.equal(again.list('you').length, 1)
  fs.writeFileSync(file, '{broken')
  again.load()
  assert.equal(again.list('you').length, 0)
})

test('keeps only the newest 200 conversations per account', () => {
  const box = createInbox(tmpFile())
  for (let i = 0; i < 210; i++) box.add('me', 'discord', { title: `p${i}`, body: 'x' }, { now: T0 + i })
  const list = box.list('me')
  assert.equal(list.length, 200)
  assert.equal(list[0].name, 'p209')
})

test('the page hook reports notifications and parseReport only trusts our marker', () => {
  const marker = '__bird_test__:'
  const sent = []
  const created = []
  class Fake {
    constructor(title, options) { created.push([title, options]) }
  }
  Fake.permission = 'granted'
  Fake.requestPermission = async () => 'granted'
  const win = { Notification: Fake }
  new Function('window', 'console', hookScript(marker))(win, { debug: (m) => sent.push(m) })
  new win.Notification('Sam', { body: 'hello there' })
  assert.deepEqual(created, [['Sam', { body: 'hello there' }]], 'the real notification still shows')
  assert.deepEqual(parseReport(marker, sent[0]), { title: 'Sam', body: 'hello there' })
  assert.equal(parseReport(marker, 'something else'), null)
  assert.equal(parseReport('other:', sent[0]), null)
  assert.equal(parseReport(marker, `${marker}not json`), null)
  assert.equal(win.Notification.permission, 'granted')
})

test('removeApp forgets one app for one user only', () => {
  const inbox = createInbox(tmpFile())
  inbox.add('u1', 'discord', { title: 'Sam', body: 'hi' })
  inbox.add('u1', 'slack', { title: 'Lee', body: 'yo' })
  inbox.add('u2', 'discord', { title: 'Kai', body: 'hey' })
  assert.equal(inbox.removeApp('u1', 'discord'), true)
  assert.deepEqual(inbox.list('u1').map((x) => x.app), ['slack'])
  assert.equal(inbox.list('u2').length, 1)
  assert.equal(inbox.removeApp('u1', 'discord'), false)
})

test('a page chat takes its unread count from the notifications for that chat', () => {
  const { withNoteCounts } = require('./inbox.cjs')
  const now = 1_000_000
  const page = (name, unread) => ({ app: 'instagram', key: `page:${name}`, name, unread })
  const note = (name, unread, at) => ({ app: 'instagram', key: `instagram:${name.toLowerCase()}`, name, unread, at })
  const { items, read } = withNoteCounts(
    [page('Sam Lee', 1), page('Ana', 0), page('Old', 0), page('Quiet', 0)],
    [note('sam lee', 4, now - 5_000), note('Ana', 2, now - 5_000), note('Old', 3, now - 120_000)],
    now,
  )
  assert.deepEqual(items.map((i) => [i.name, i.unread]), [['Sam Lee', 4], ['Ana', 2], ['Old', 0], ['Quiet', 0]])
  assert.deepEqual(read, ['instagram:old'])
})
