import { createServer } from 'node:http'

// A tiny stand-in for a Matrix homeserver (just the calls Bird makes), with the
// kind of rooms the mautrix bridges create.
const ME = '@alice:localhost'
const ts = (minutesAgo) => Date.now() - minutesAgo * 60_000

const member = (id, displayname) => ({
  type: 'm.room.member',
  state_key: id,
  sender: id,
  content: { membership: 'join', displayname },
})
const bridge = (protocol) => ({
  type: 'm.bridge',
  state_key: `net.maunium.${protocol}://${protocol}/1`,
  sender: '@bot:localhost',
  content: { protocol: { id: protocol } },
})
const named = (name) => ({ type: 'm.room.name', state_key: '', sender: '@bot:localhost', content: { name } })
const msg = (id, sender, body, minutesAgo, msgtype = 'm.text', extra = {}) => ({
  type: 'm.room.message',
  event_id: id,
  sender,
  origin_server_ts: ts(minutesAgo),
  content: { msgtype, body, ...extra },
})

export function initialSync() {
  return {
    next_batch: 's1',
    rooms: {
      join: {
        '!wa1:localhost': {
          summary: { 'm.joined_member_count': 2, 'm.invited_member_count': 0 },
          state: { events: [bridge('whatsapp'), named('Sam (WhatsApp)')] },
          timeline: {
            events: [
              msg('$wa1', '@whatsapp_123:localhost', 'hey, are you free later?', 30),
              msg('$wa2', ME, 'yes! around 6', 28),
              msg('$wa3', '@whatsapp_123:localhost', 'perfect', 25),
              { ...msg('$wa-edit', '@whatsapp_123:localhost', '* perfect!', 24), content: { msgtype: 'm.text', body: '* perfect!', 'm.relates_to': { rel_type: 'm.replace', event_id: '$wa3' } } },
            ],
          },
          unread_notifications: { notification_count: 2, highlight_count: 0 },
        },
        '!dc1:localhost': {
          summary: { 'm.joined_member_count': 3, 'm.invited_member_count': 0 },
          state: {
            events: [
              bridge('discord'),
              named('Dev chat'),
              member('@discord_9:localhost', 'Priya'),
              member('@discord_8:localhost', 'Kai'),
            ],
          },
          timeline: {
            events: [
              msg('$dc1', '@discord_9:localhost', 'standup in 5', 10),
              msg('$dc2', '@discord_8:localhost', 'on my way', 9, 'm.image', { info: {} }),
              msg('$dc3', '@discord_9:localhost', 'voice note', 8, 'm.audio', { info: { duration: 14000 } }),
            ],
          },
          unread_notifications: { notification_count: 0, highlight_count: 0 },
        },
        '!bot:localhost': {
          summary: { 'm.joined_member_count': 2, 'm.invited_member_count': 0, 'm.heroes': ['@whatsappbot:localhost'] },
          state: { events: [member('@whatsappbot:localhost', 'WhatsApp bridge bot')] },
          timeline: { events: [msg('$bot1', '@whatsappbot:localhost', 'Send `login` to link WhatsApp', 60, 'm.notice')] },
        },
      },
      invite: {
        '!inv1:localhost': {
          invite_state: {
            events: [{ type: 'm.room.member', state_key: ME, sender: '@whatsappbot:localhost', content: { membership: 'invite' } }],
          },
        },
        '!spam:evil.org': {
          invite_state: {
            events: [{ type: 'm.room.member', state_key: ME, sender: '@spammer:evil.org', content: { membership: 'invite' } }],
          },
        },
      },
    },
  }
}

export async function startFakeHomeserver() {
  const log = { logins: [], sent: [], receipts: [], joins: [], logouts: 0 }
  const queue = [] // batches to hand out on later syncs
  let batch = 1
  let eventCounter = 0
  let tokenRevoked = false

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
    const send = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    const path = url.pathname.replace('/_matrix/client/v3', '')
    const authed = req.headers.authorization === 'Bearer tok-1' && !tokenRevoked

    if (path === '/login') {
      log.logins.push(body.identifier?.user)
      if (body.identifier?.user !== 'alice' || body.password !== 'right-password') {
        return send(403, { errcode: 'M_FORBIDDEN', error: 'Invalid username or password' })
      }
      return send(200, { access_token: 'tok-1', user_id: ME, device_id: 'DEV1' })
    }
    if (!authed) return send(401, { errcode: 'M_UNKNOWN_TOKEN', error: 'Unknown token' })

    if (path === '/logout') {
      log.logouts += 1
      return send(200, {})
    }
    if (path === '/sync') {
      if (!url.searchParams.get('since')) return send(200, initialSync())
      const deadline = Date.now() + Number(url.searchParams.get('timeout') ?? 0)
      while (!queue.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
      const rooms = queue.shift() ?? {}
      batch += 1
      return send(200, { next_batch: `s${batch}`, rooms: { join: rooms } })
    }
    let m
    if ((m = path.match(/^\/rooms\/([^/]+)\/send\/m\.room\.message\/([^/]+)$/)) && req.method === 'PUT') {
      const roomId = decodeURIComponent(m[1])
      const eventId = `$sent${++eventCounter}`
      log.sent.push({ roomId, body: body.body, txn: m[2], eventId })
      // The homeserver reports our own message back on the next sync.
      queue.push({
        [roomId]: { timeline: { events: [msg(eventId, ME, body.body, 0)] } },
      })
      return send(200, { event_id: eventId })
    }
    if ((m = path.match(/^\/rooms\/([^/]+)\/receipt\/m\.read\/([^/]+)$/))) {
      log.receipts.push({ roomId: decodeURIComponent(m[1]), eventId: decodeURIComponent(m[2]) })
      return send(200, {})
    }
    if ((m = path.match(/^\/join\/([^/]+)$/))) {
      log.joins.push(decodeURIComponent(m[1]))
      return send(200, { room_id: decodeURIComponent(m[1]) })
    }
    return send(404, { errcode: 'M_NOT_FOUND', error: 'Not found' })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    log,
    // Make a message arrive in a room on the next sync.
    deliver: (roomId, ev) => queue.push({ [roomId]: { timeline: { events: [ev] }, unread_notifications: { notification_count: 1, highlight_count: 0 } } }),
    revokeToken: () => { tokenRevoked = true },
    close: () => server.close(),
    msg,
  }
}
