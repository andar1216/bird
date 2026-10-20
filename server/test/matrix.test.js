import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { randomBytes } from 'node:crypto'

// Settings must be in place before the app modules read them.
process.env.MATRIX_SYNC_TIMEOUT_MS = '200'
process.env.BIRD_SECRET_KEY = randomBytes(32).toString('base64')

const { default: mongoose } = await import('mongoose')
const { createApp } = await import('../src/app.js')
const { connectDb, disconnectDb } = await import('../src/db.js')
const { stopAllSync } = await import('../src/matrix/sync.js')
const { MatrixAccount } = await import('../src/models/MatrixAccount.js')
const { Message } = await import('../src/models/Message.js')
const { encryptSecret, decryptSecret } = await import('../src/lib/secrets.js')
const { normalizeHomeserver } = await import('../src/matrix/client.js')
const { eventToMessage, networkFromState, roomDetails } = await import('../src/matrix/mapping.js')
const { startFakeHomeserver } = await import('./support/fakeHomeserver.js')

// WARNING: this database is dropped before and after the run.
const TEST_URI = process.env.MONGODB_URI_TEST_MATRIX ?? 'mongodb://127.0.0.1:27017/bird_test_matrix'

let server
let base
let hs

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

const register = async (username) =>
  (await call('POST', '/api/auth/register', { body: { username, password: 'correct-horse-9' } })).body.token

async function until(fn, what, ms = 5000) {
  const end = Date.now() + ms
  for (;;) {
    const value = await fn()
    if (value) return value
    if (Date.now() > end) assert.fail(`timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

const chats = async (token) => (await call('GET', '/api/chats', { token })).body.chats
const byName = (list, name) => list.find((c) => c.name === name)

before(async () => {
  assert.match(new URL(TEST_URI).pathname, /test/i, 'refusing to drop a non-test database')
  hs = await startFakeHomeserver()
  await connectDb(TEST_URI)
  await mongoose.connection.dropDatabase()
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  stopAllSync()
  server?.close()
  hs?.close()
  await mongoose.connection.dropDatabase()
  await disconnectDb()
})

describe('matrix helpers', () => {
  it('normalizes homeserver addresses and only allows http on this computer', () => {
    assert.equal(normalizeHomeserver('matrix.example.com'), 'https://matrix.example.com')
    assert.equal(normalizeHomeserver(' https://matrix.example.com/ '), 'https://matrix.example.com')
    assert.equal(normalizeHomeserver('http://localhost:8008'), 'http://localhost:8008')
    assert.throws(() => normalizeHomeserver('http://matrix.example.com'))
    assert.throws(() => normalizeHomeserver('https://user:pw@matrix.example.com'))
    assert.throws(() => normalizeHomeserver(''))
  })

  it('encrypts secrets and rejects tampering', () => {
    const packed = encryptSecret('tok-secret')
    assert.ok(!packed.includes('tok-secret'))
    assert.equal(decryptSecret(packed), 'tok-secret')
    assert.notEqual(encryptSecret('tok-secret'), packed, 'a fresh IV each time')
    const [iv, tag, data] = packed.split('.')
    const flipped = Buffer.from(data, 'base64')
    flipped[0] ^= 1
    assert.throws(() => decryptSecret([iv, tag, flipped.toString('base64')].join('.')))
  })

  it('finds the network from bridge state events', () => {
    const bridge = (id) => [{ type: 'm.bridge', content: { protocol: { id } } }]
    assert.equal(networkFromState(bridge('whatsapp')), 'whatsapp')
    assert.equal(networkFromState(bridge('facebook')), 'messenger')
    assert.equal(networkFromState(bridge('gmessages')), 'messages')
    assert.equal(networkFromState(bridge('mystery')), 'matrix')
    assert.equal(networkFromState([{ type: 'uk.half-shot.bridge', content: { protocol: { id: 'Discord' } } }]), 'discord')
    assert.equal(networkFromState([]), undefined)
  })

  it('names rooms and tells groups from direct chats', () => {
    const names = new Map([['@kai:hs', 'Kai']])
    assert.deepEqual(
      roomDetails([], { 'm.heroes': ['@me:hs', '@kai:hs'], 'm.joined_member_count': 2 }, '@me:hs', names),
      { name: 'Kai', group: false },
    )
    assert.equal(roomDetails([], { 'm.joined_member_count': 3 }, '@me:hs', names).group, true)
    assert.deepEqual(roomDetails([], undefined, '@me:hs', names), { name: undefined, group: undefined })
  })

  it('maps events to messages and skips edits and reactions', () => {
    const ctx = { myMxid: '@me:hs', group: true, names: new Map([['@kai:hs', 'Kai']]) }
    const ev = (extra) => ({ type: 'm.room.message', event_id: '$e', sender: '@kai:hs', origin_server_ts: 1000, content: { msgtype: 'm.text', body: 'hi' }, ...extra })
    assert.deepEqual(eventToMessage(ev(), ctx).sender, 'Kai')
    assert.equal(eventToMessage(ev({ sender: '@me:hs' }), ctx).from, 'me')
    assert.equal(eventToMessage(ev({ sender: '@me:hs' }), ctx).sender, undefined)
    assert.equal(eventToMessage(ev({ content: { msgtype: 'm.audio', body: 'v', info: { duration: 75000 } } }), ctx).duration, '1:15')
    assert.equal(eventToMessage(ev({ content: { msgtype: 'm.text', body: '* x', 'm.relates_to': { rel_type: 'm.replace' } } }), ctx), null)
    assert.equal(eventToMessage(ev({ type: 'm.reaction' }), ctx), null)
    assert.match(eventToMessage(ev({ type: 'm.room.encrypted' }), ctx).text, /Encrypted/)
  })
})

describe('matrix account and sync', () => {
  let alice
  let bob

  before(async () => {
    alice = await register('alice')
    bob = await register('bob')
  })

  it('has no account to start with and requires sign-in', async () => {
    assert.deepEqual((await call('GET', '/api/matrix', { token: alice })).body, { account: null })
    assert.equal((await call('GET', '/api/matrix')).status, 401)
  })

  it('rejects a wrong password and an insecure address', async () => {
    const put = (body) => call('PUT', '/api/matrix', { token: alice, body })
    assert.equal((await put({ homeserver: hs.url, username: 'alice', password: 'nope' })).status, 400)
    assert.equal((await put({ homeserver: 'http://example.com', username: 'alice', password: 'x' })).status, 400)
    assert.equal((await put({ homeserver: hs.url })).status, 400)
  })

  it('signs in, never exposes the token, and stores it encrypted', async () => {
    const res = await call('PUT', '/api/matrix', {
      token: alice,
      body: { homeserver: hs.url, username: 'alice', password: 'right-password' },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.account.mxid, '@alice:localhost')
    const raw = JSON.stringify(res.body)
    assert.ok(!raw.includes('tok-1') && !raw.includes('right-password') && !/accessToken/i.test(raw))

    const stored = await MatrixAccount.findOne({}).lean()
    assert.ok(!JSON.stringify(stored).includes('tok-1'))
    assert.equal(decryptSecret(stored.accessTokenEnc), 'tok-1')
  })

  it('imports rooms as chats on the right networks, with names and groups', async () => {
    const list = await until(async () => {
      const l = await chats(alice)
      return l.length >= 3 && l
    }, 'chats to appear')

    const sam = byName(list, 'Sam (WhatsApp)')
    assert.equal(sam.network, 'whatsapp')
    assert.equal(sam.group, false)
    assert.equal(sam.unread, 2)
    assert.equal(sam.lastMessage.text, 'perfect', 'the edit does not replace the message')

    const dev = byName(list, 'Dev chat')
    assert.equal(dev.network, 'discord')
    assert.equal(dev.group, true)

    const bot = byName(list, 'WhatsApp bridge bot')
    assert.equal(bot.network, 'matrix', 'a room with no bridge is a plain Matrix chat')
  })

  it('stores history with senders, replies and media', async () => {
    const list = await chats(alice)
    const wa = (await call('GET', `/api/chats/${byName(list, 'Sam (WhatsApp)').id}/messages`, { token: alice })).body.messages
    assert.deepEqual(wa.map((m) => [m.from, m.text]), [
      ['them', 'hey, are you free later?'],
      ['me', 'yes! around 6'],
      ['them', 'perfect'],
    ])
    const dc = (await call('GET', `/api/chats/${byName(list, 'Dev chat').id}/messages`, { token: alice })).body.messages
    assert.deepEqual(dc.map((m) => [m.sender, m.type]), [['Priya', 'text'], ['Kai', 'image'], ['Priya', 'voice']])
    assert.equal(dc[2].duration, '0:14')
  })

  it('marks networks connected through Matrix', async () => {
    const { connections } = (await call('GET', '/api/connections', { token: alice })).body
    const get = (n) => connections.find((c) => c.network === n)
    for (const n of ['whatsapp', 'discord', 'matrix']) {
      assert.equal(get(n).status, 'connected')
      assert.equal(get(n).provider, 'matrix')
      assert.equal(get(n).label, '@alice:localhost')
    }
    assert.equal(get('telegram').status, 'disconnected')
  })

  it('joins invites from its own homeserver only', () => {
    assert.deepEqual(hs.log.joins, ['!inv1:localhost'])
  })

  it('sends through Matrix and the echo does not duplicate the message', async () => {
    const chat = byName(await chats(alice), 'Sam (WhatsApp)')
    const res = await call('POST', `/api/chats/${chat.id}/messages`, { token: alice, body: { text: 'on my way' } })
    assert.equal(res.status, 201)
    assert.equal(res.body.message.status, 'sent')
    assert.deepEqual(hs.log.sent.map((s) => [s.roomId, s.body]), [['!wa1:localhost', 'on my way']])

    // wait for the echo to come back through /sync, then count
    await until(async () => (await Message.countDocuments({ text: 'on my way' })) >= 1, 'the message')
    await new Promise((r) => setTimeout(r, 700))
    assert.equal(await Message.countDocuments({ text: 'on my way' }), 1)
  })

  it('picks up new messages in the background and raises unread', async () => {
    hs.deliver('!wa1:localhost', hs.msg('$wa9', '@whatsapp_123:localhost', 'see you soon', 0))
    const chat = await until(async () => {
      const c = byName(await chats(alice), 'Sam (WhatsApp)')
      return c.lastMessage.text === 'see you soon' && c
    }, 'the new message')
    assert.equal(chat.unread, 1)
    assert.equal(chat.name, 'Sam (WhatsApp)', 'a sync with no state keeps the name')
    assert.equal(chat.network, 'whatsapp')
  })

  it('sends a read receipt for the newest message when a chat is read', async () => {
    const chat = byName(await chats(alice), 'Sam (WhatsApp)')
    const res = await call('POST', `/api/chats/${chat.id}/read`, { token: alice })
    assert.equal(res.status, 200)
    assert.equal(res.body.chat.unread, 0)
    assert.deepEqual(hs.log.receipts.at(-1), { roomId: '!wa1:localhost', eventId: '$wa9' })
  })

  it('keeps another user out of the account and its chats', async () => {
    assert.deepEqual((await call('GET', '/api/matrix', { token: bob })).body, { account: null })
    assert.deepEqual(await chats(bob), [])
    const { connections } = (await call('GET', '/api/connections', { token: bob })).body
    assert.ok(connections.every((c) => c.status === 'disconnected'))
    const aliceChat = byName(await chats(alice), 'Dev chat')
    assert.equal((await call('GET', `/api/chats/${aliceChat.id}/messages`, { token: bob })).status, 404)
    assert.equal((await call('POST', `/api/chats/${aliceChat.id}/messages`, { token: bob, body: { text: 'x' } })).status, 404)
  })

  it('disconnects: signs out, forgets chats and messages', async () => {
    const res = await call('DELETE', '/api/matrix', { token: alice })
    assert.equal(res.status, 204)
    assert.equal(hs.log.logouts >= 1, true)
    assert.deepEqual((await call('GET', '/api/matrix', { token: alice })).body, { account: null })
    assert.deepEqual(await chats(alice), [])
    assert.equal(await Message.countDocuments({}), 0)
    const { connections } = (await call('GET', '/api/connections', { token: alice })).body
    assert.ok(connections.every((c) => c.status === 'disconnected'))
  })

  it('reports an error when the homeserver revokes the token', async () => {
    const res = await call('PUT', '/api/matrix', {
      token: alice,
      body: { homeserver: hs.url, username: 'alice', password: 'right-password' },
    })
    assert.equal(res.status, 200)
    await until(async () => (await chats(alice)).length >= 3, 'chats after reconnect')
    hs.revokeToken()
    const account = await until(async () => {
      const a = (await call('GET', '/api/matrix', { token: alice })).body.account
      return a.status === 'error' && a
    }, 'an error status')
    assert.match(account.lastError, /Connect again/)
  })
})
