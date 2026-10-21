import { hostOf } from './customApps'

// Networks the app knows about. Keep in sync with server/src/networks.js and
// electron/networks.cjs. Chats now come from the Bird server (see src/api.js).
export const NETWORKS = {
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    blurb: 'Photos and DMs',
    color: '#e1306c',
    url: 'https://www.instagram.com/direct/inbox/',
  },
  snapchat: {
    id: 'snapchat',
    name: 'Snapchat',
    blurb: 'Snaps and chats',
    color: '#fffc00',
    url: 'https://web.snapchat.com/',
  },
  messages: {
    id: 'messages',
    name: 'Google Messages',
    blurb: 'Texts from your phone',
    color: '#1a73e8',
    url: 'https://messages.google.com/web',
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    blurb: 'Servers and DMs',
    color: '#5865f2',
    url: 'https://discord.com/app',
  },
}

export const NETWORK_ORDER = ['instagram', 'snapchat', 'messages', 'discord']

// Apps users can add with the "+" button. These are web-only: they open the
// official site in the desktop shell (hosts live in electron/networks.cjs) and
// have no chat adapter on the server.
export const WEB_APPS = {
  whatsapp: { id: 'whatsapp', name: 'WhatsApp', color: '#25d366', blurb: 'Chats and calls' },
  messenger: { id: 'messenger', name: 'Messenger', color: '#0a7cff', blurb: 'Facebook messages' },
  facebook: { id: 'facebook', name: 'Facebook', color: '#1877f2', blurb: 'Feed and groups' },
  x: { id: 'x', name: 'X', color: '#000000', blurb: 'Posts and DMs' },
  telegram: { id: 'telegram', name: 'Telegram', color: '#27a7e7', blurb: 'Chats and channels' },
  slack: { id: 'slack', name: 'Slack', color: '#4a154b', blurb: 'Work chat' },
  teams: { id: 'teams', name: 'Microsoft Teams', color: '#5059c9', blurb: 'Work chat and meetings' },
  linkedin: { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', blurb: 'Messaging' },
  tiktok: { id: 'tiktok', name: 'TikTok', color: '#010101', blurb: 'Messages' },
  gmail: { id: 'gmail', name: 'Gmail', color: '#ea4335', blurb: 'Email' },
  reddit: { id: 'reddit', name: 'Reddit', color: '#ff4500', blurb: 'Communities and chats' },
}

// Every app Bird can show an icon for: the ones above plus the ones this account
// added itself (see customApps.js), which are swapped in by registerCustomApps.
export const APPS = { ...NETWORKS, ...WEB_APPS }

const CUSTOM_COLORS = ['#e1306c', '#1a73e8', '#25d366', '#8a52ff', '#ff7a45', '#1fa2b8', '#d93f87', '#3d6bff']
const colorForHost = (host) => {
  let h = 0
  for (const ch of host) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return CUSTOM_COLORS[h % CUSTOM_COLORS.length]
}

export function registerCustomApps(list) {
  for (const id of Object.keys(APPS)) if (APPS[id].custom) delete APPS[id]
  for (const c of list) {
    let host
    try {
      host = hostOf(c.url)
    } catch {
      continue
    }
    APPS[c.id] = {
      id: c.id,
      name: c.name,
      color: colorForHost(host),
      blurb: host,
      url: c.url,
      icon: `https://${host}/favicon.ico`,
      custom: true,
    }
  }
}
