// Turning Matrix rooms and events into Bird chats and messages. Pure functions.

// Bridges say which network a room belongs to in an `m.bridge` state event
// (older ones use `uk.half-shot.bridge`): content.protocol.id.
const PROTOCOLS = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  facebook: 'messenger',
  'facebook-tor': 'messenger',
  facebookgo: 'messenger',
  messenger: 'messenger',
  meta: 'messenger',
  discord: 'discord',
  telegram: 'telegram',
  slack: 'slack',
  gmessages: 'messages',
  googlemessages: 'messages',
  'google-messages': 'messages',
}
const BRIDGE_EVENTS = ['m.bridge', 'uk.half-shot.bridge']

// The network a batch of state events says the room is bridged to: a Bird
// network id, 'matrix' for a bridge Bird doesn't know, or undefined when the
// events don't mention a bridge at all.
export function networkFromState(events) {
  const bridge = events.find((e) => BRIDGE_EVENTS.includes(e.type) && e.content?.protocol)
  if (!bridge) return undefined
  const id = String(bridge.content.protocol.id ?? '').toLowerCase()
  return PROTOCOLS[id] ?? 'matrix'
}

const PALETTE = [
  ['#ff7eb3', '#ff4d8d'],
  ['#ffb36b', '#ff7a45'],
  ['#8ee27a', '#2fbf71'],
  ['#6fe0d6', '#1fa2b8'],
  ['#7fb2ff', '#3d6bff'],
  ['#c59bff', '#8a52ff'],
]

export function colorsFor(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const localpart = (mxid) => String(mxid).replace(/^@/, '').split(':')[0]
export const serverOf = (mxid) => String(mxid).split(':').slice(1).join(':')

// Remember who is who from member events (for names inside group chats).
export function memberNames(events, into = new Map()) {
  for (const e of events) {
    if (e.type === 'm.room.member' && e.state_key && e.content?.displayname) {
      into.set(e.state_key, String(e.content.displayname))
    }
  }
  return into
}

// Name and group flag from room state, or undefined parts when this batch doesn't say.
export function roomDetails(stateEvents, summary, myMxid, names) {
  const named = stateEvents.find((e) => e.type === 'm.room.name' && e.content?.name)
  const alias = stateEvents.find((e) => e.type === 'm.room.canonical_alias' && e.content?.alias)
  let name = named?.content.name ?? alias?.content.alias
  if (!name && summary?.['m.heroes']?.length) {
    const others = summary['m.heroes'].filter((id) => id !== myMxid)
    name = others.map((id) => names.get(id) ?? localpart(id)).join(', ') || undefined
  }
  let group
  if (summary && (summary['m.joined_member_count'] !== undefined || summary['m.invited_member_count'] !== undefined)) {
    group = (summary['m.joined_member_count'] ?? 0) + (summary['m.invited_member_count'] ?? 0) > 2
  }
  return { name: name ? String(name).slice(0, 120) : undefined, group }
}

const formatDuration = (ms) => {
  const total = Math.round(Number(ms) / 1000)
  if (!Number.isFinite(total) || total < 0) return undefined
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// A message event as a Bird message, or null for events we don't show
// (edits, reactions, state, ...).
export function eventToMessage(ev, { myMxid, group, names }) {
  if (!ev?.event_id || !Number.isFinite(ev.origin_server_ts)) return null
  const from = ev.sender === myMxid ? 'me' : 'them'
  const base = {
    externalId: ev.event_id,
    from,
    sender: group && from === 'them' ? names.get(ev.sender) ?? localpart(ev.sender) : undefined,
    sentAt: new Date(ev.origin_server_ts),
  }
  if (ev.type === 'm.room.encrypted') {
    return { ...base, type: 'text', text: '🔒 Encrypted message (Bird can’t read it)' }
  }
  if (ev.type !== 'm.room.message') return null
  const c = ev.content ?? {}
  if (c['m.relates_to']?.rel_type === 'm.replace') return null // an edit of an earlier message
  const body = typeof c.body === 'string' ? c.body : ''
  switch (c.msgtype) {
    case 'm.text':
    case 'm.notice':
      return body ? { ...base, type: 'text', text: body.slice(0, 4000) } : null
    case 'm.emote':
      return body ? { ...base, type: 'text', text: `* ${body}`.slice(0, 4000) } : null
    case 'm.image':
      return { ...base, type: 'image', caption: body.slice(0, 1000) || undefined }
    case 'm.audio':
      return { ...base, type: 'voice', duration: formatDuration(c.info?.duration) }
    case 'm.video':
      return { ...base, type: 'text', text: `🎬 ${body || 'Video'}`.slice(0, 4000) }
    case 'm.file':
      return { ...base, type: 'text', text: `📎 ${body || 'File'}`.slice(0, 4000) }
    default:
      return body ? { ...base, type: 'text', text: body.slice(0, 4000) } : null
  }
}
