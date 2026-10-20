// Networks the app knows about. Keep in sync with server/src/networks.js and
// electron/networks.cjs. Chats now come from the Bird server (see src/api.js).
export const NETWORKS = {
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    color: '#e1306c',
    url: 'https://www.instagram.com/direct/inbox/',
  },
  snapchat: {
    id: 'snapchat',
    name: 'Snapchat',
    color: '#fffc00',
    url: 'https://web.snapchat.com/',
  },
  messages: {
    id: 'messages',
    name: 'Google Messages',
    color: '#1a73e8',
    url: 'https://messages.google.com/web',
  },
  discord: {
    id: 'discord',
    name: 'Discord',
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
}

// Every app Bird can show an icon for.
export const APPS = { ...NETWORKS, ...WEB_APPS }
