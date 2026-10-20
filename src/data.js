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
