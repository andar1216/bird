import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { registerAdapter } from '../src/adapters/index.js'
import { createApp } from '../src/app.js'
import { connectDb, disconnectDb } from '../src/db.js'
import { demoAdapter } from './support/demoAdapter.js'

// WARNING: this database is dropped before and after the run.
const TEST_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/bird_test'

let server
let base

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

const userId = async (token) => (await call('GET', '/api/auth/me', { token })).body.user.id

const register = (username, displayName) =>
  call('POST', '/api/auth/register', {
    body: { username, password: 'correct-horse-9', ...(displayName ? { displayName } : {}) },
  })

before(async () => {
  assert.match(new URL(TEST_URI).pathname, /test/i, 'refusing to drop a non-test database')
  registerAdapter(demoAdapter) // the app ships no adapters; tests use sample data
  await connectDb(TEST_URI)
  await mongoose.connection.dropDatabase()
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server?.close()
  await mongoose.connection.dropDatabase()
  await disconnectDb()
})

describe('auth', () => {
  it('registers with a username, returns a token, and resolves /me', async () => {
    const res = await register('Ada_L', 'Ada')
    assert.equal(res.status, 201)
    assert.ok(res.body.token)
    assert.equal(res.body.user.username, 'ada_l', 'usernames are lowercased')
    assert.equal(res.body.user.passwordHash, undefined)

    const me = await call('GET', '/api/auth/me', { token: res.body.token })
    assert.equal(me.status, 200)
    assert.equal(me.body.user.displayName, 'Ada')
  })

  it('uses the username as display name when none is given', async () => {
    const res = await register('plain.jane')
    assert.equal(res.body.user.displayName, 'plain.jane')
  })

  it('stores only a hash of the session token and a scrypt password hash', async () => {
    const { token } = (await register('hasher')).body
    const { Session } = await import('../src/models/Session.js')
    const { User } = await import('../src/models/User.js')
    assert.equal(await Session.countDocuments({ tokenHash: token }), 0)
    const user = await User.findOne({ username: 'hasher' }).select('+passwordHash')
    assert.notEqual(user.passwordHash, 'correct-horse-9')
  })

  it('rejects taken usernames (any case), bad usernames and weak passwords', async () => {
    assert.equal((await register('ada_l')).status, 409)
    assert.equal((await register('ADA_L')).status, 409)
    assert.equal((await register('no spaces')).status, 400)
    assert.equal((await register('ab')).status, 400)
    assert.equal((await register('a@b.com')).status, 400)
    const weak = await call('POST', '/api/auth/register', {
      body: { username: 'weakling', password: 'short' },
    })
    assert.equal(weak.status, 400)
  })

  it('logs in with the right username and password only', async () => {
    const ok = await call('POST', '/api/auth/login', {
      body: { username: 'Ada_L', password: 'correct-horse-9' },
    })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.user.username, 'ada_l')
    const bad = await call('POST', '/api/auth/login', {
      body: { username: 'ada_l', password: 'wrong-password' },
    })
    assert.equal(bad.status, 401)
    const unknown = await call('POST', '/api/auth/login', {
      body: { username: 'nobody', password: 'whatever-123' },
    })
    assert.equal(unknown.status, 401)
    assert.equal(unknown.body.error, bad.body.error)
  })

  it('requires auth and revokes tokens on logout', async () => {
    assert.equal((await call('GET', '/api/chats')).status, 401)
    assert.equal((await call('GET', '/api/chats', { token: 'nope' })).status, 401)

    const { token } = (await register('logout-user')).body
    assert.equal((await call('POST', '/api/auth/logout', { token })).status, 204)
    assert.equal((await call('GET', '/api/auth/me', { token })).status, 401)
  })

  it('migrates v1 email accounts to usernames, and they can still sign in', async () => {
    const { User } = await import('../src/models/User.js')
    const { migrate } = await import('../src/migrate.js')
    const { passwordHash, passwordSalt } = await User.findOne({ username: 'hasher' }).select(
      '+passwordHash +passwordSalt',
    )
    const users = mongoose.connection.collection('users')

    // Recreate the v1 shape: no username index, accounts identified by email.
    await users.dropIndex('username_1')
    await users.createIndex({ email: 1 }, { unique: true, sparse: true })
    await users.insertMany([
      { email: 'Old.Timer@example.com', displayName: 'Old', passwordHash, passwordSalt },
      { email: 'old.timer@other.org', displayName: 'Old 2', passwordHash, passwordSalt },
    ])

    await migrate()
    await migrate() // safe to re-run
    await User.createIndexes()

    const names = (await users.find({}).toArray()).map((u) => u.username)
    assert.ok(names.every(Boolean), 'every account has a username')
    assert.ok(names.includes('old.timer'))
    assert.ok(names.includes('old.timer2'), 'collisions get a numeric suffix')
    assert.equal(await users.countDocuments({ email: { $exists: true } }), 0)

    const login = await call('POST', '/api/auth/login', {
      body: { username: 'old.timer', password: 'correct-horse-9' },
    })
    assert.equal(login.status, 200)
    assert.equal((await register('brand-new')).status, 201, 'new sign-ups work after migration')
  })
})

describe('per-user data', () => {
  let alice
  let bob

  before(async () => {
    alice = (await register('alice', 'Alice')).body.token
    bob = (await register('bob', 'Bob')).body.token
  })

  it('starts empty and lists every network as disconnected', async () => {
    assert.deepEqual((await call('GET', '/api/chats', { token: alice })).body.chats, [])
    const { connections } = (await call('GET', '/api/connections', { token: alice })).body
    assert.equal(connections.length, 4)
    assert.ok(connections.every((c) => c.status === 'disconnected'))
  })

  it('connects a network and seeds that user only', async () => {
    const put = await call('PUT', '/api/connections/discord', {
      token: alice,
      body: { provider: 'demo' },
    })
    assert.equal(put.status, 200)
    assert.equal(put.body.connection.status, 'connected')

    const { chats } = (await call('GET', '/api/chats', { token: alice })).body
    assert.ok(chats.length > 0)
    assert.ok(chats.every((c) => c.network === 'discord'))

    assert.deepEqual((await call('GET', '/api/chats', { token: bob })).body.chats, [])
  })

  it('is idempotent when connecting twice', async () => {
    const before = (await call('GET', '/api/chats', { token: alice })).body.chats.length
    await call('PUT', '/api/connections/discord', { token: alice, body: { provider: 'demo' } })
    const after = (await call('GET', '/api/chats', { token: alice })).body.chats.length
    assert.equal(after, before)
  })

  it('rejects unknown networks and providers', async () => {
    assert.equal(
      (await call('PUT', '/api/connections/myspace', { token: alice, body: { provider: 'demo' } }))
        .status,
      404,
    )
    assert.equal(
      (await call('PUT', '/api/connections/discord', { token: alice, body: { provider: 'nope' } }))
        .status,
      400,
    )
  })

  it("hides one user's chats and messages from another (404)", async () => {
    const [chat] = (await call('GET', '/api/chats', { token: alice })).body.chats
    const paths = [`/api/chats/${chat.id}/messages`, `/api/chats/${chat.id}/read`, `/api/chats/${chat.id}`]

    assert.equal((await call('GET', paths[0], { token: bob })).status, 404)
    assert.equal((await call('POST', paths[0], { token: bob, body: { text: 'hi' } })).status, 404)
    assert.equal((await call('POST', paths[1], { token: bob })).status, 404)
    assert.equal((await call('PATCH', paths[2], { token: bob, body: { pinned: true } })).status, 404)
    assert.equal((await call('GET', '/api/chats/not-an-id/messages', { token: alice })).status, 404)

    // ...but Alice can.
    assert.equal((await call('GET', paths[0], { token: alice })).status, 200)
  })

  it('sends a message and updates the chat preview', async () => {
    const chats = (await call('GET', '/api/chats', { token: alice })).body.chats
    const chat = chats[chats.length - 1]
    const sent = await call('POST', `/api/chats/${chat.id}/messages`, {
      token: alice,
      body: { text: '  hello there  ' },
    })
    assert.equal(sent.status, 201)
    assert.equal(sent.body.message.text, 'hello there')
    assert.equal(sent.body.message.status, 'sent')

    const list = await call('GET', '/api/chats', { token: alice })
    assert.equal(list.body.chats[0].id, chat.id, 'most recent chat sorts first')
    assert.equal(list.body.chats[0].lastMessage.text, 'hello there')

    const msgs = (await call('GET', `/api/chats/${chat.id}/messages`, { token: alice })).body.messages
    assert.equal(msgs[msgs.length - 1].text, 'hello there')
    const times = msgs.map((m) => new Date(m.sentAt).getTime())
    assert.deepEqual(times, [...times].sort((a, b) => a - b), 'oldest first')
  })

  it('refuses to send when the network is not connected', async () => {
    await call('PUT', '/api/connections/snapchat', { token: alice, body: { provider: 'demo' } })
    const chat = (await call('GET', '/api/chats', { token: alice })).body.chats.find(
      (c) => c.network === 'snapchat',
    )
    const { Connection } = await import('../src/models/Connection.js')
    await Connection.deleteOne({ network: 'snapchat', userId: (await userId(alice)) })
    assert.equal(
      (await call('POST', `/api/chats/${chat.id}/messages`, { token: alice, body: { text: 'x' } }))
        .status,
      409,
    )

    // Disconnecting via the API also forgets the network's chats.
    await call('DELETE', '/api/connections/snapchat', { token: alice })
    assert.equal(
      (await call('POST', `/api/chats/${chat.id}/messages`, { token: alice, body: { text: 'x' } }))
        .status,
      404,
    )
  })

  it('marks chats read and patches flags (only allowed fields)', async () => {
    const chat = (await call('GET', '/api/chats', { token: alice })).body.chats.find(
      (c) => c.unread > 0,
    )
    const read = await call('POST', `/api/chats/${chat.id}/read`, { token: alice })
    assert.equal(read.body.chat.unread, 0)

    const patched = await call('PATCH', `/api/chats/${chat.id}`, {
      token: alice,
      body: { archived: true },
    })
    assert.equal(patched.body.chat.archived, true)
    const bad = await call('PATCH', `/api/chats/${chat.id}`, {
      token: alice,
      body: { unread: 99, userId: 'x' },
    })
    assert.equal(bad.status, 400)
  })

  it('disconnect removes that network’s data for that user only', async () => {
    await call('PUT', '/api/connections/discord', { token: bob, body: { provider: 'demo' } })
    assert.equal((await call('DELETE', '/api/connections/discord', { token: alice })).status, 204)

    assert.deepEqual((await call('GET', '/api/chats', { token: alice })).body.chats, [])
    assert.ok((await call('GET', '/api/chats', { token: bob })).body.chats.length > 0)
    const { Message } = await import('../src/models/Message.js')
    const aliceId = (await call('GET', '/api/auth/me', { token: alice })).body.user.id
    assert.equal(await Message.countDocuments({ userId: aliceId }), 0)
  })
})

describe('demo data removal', () => {
  it('migrate() deletes sample chats, their messages and connections for every account', async () => {
    const { migrate } = await import('../src/migrate.js')
    const { token } = (await register('had-demo')).body
    await call('PUT', '/api/connections/instagram', { token, body: { provider: 'demo' } })
    assert.ok((await call('GET', '/api/chats', { token })).body.chats.length > 0)

    await migrate()
    await migrate() // safe to re-run

    assert.equal((await call('GET', '/api/chats', { token })).body.chats.length, 0)
    const conns = (await call('GET', '/api/connections', { token })).body.connections
    assert.ok(conns.every((c) => c.status === 'disconnected'))
    assert.equal(await mongoose.connection.collection('messages').countDocuments({}), 0)
  })
})
