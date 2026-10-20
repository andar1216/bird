// Networks a chat can belong to. Must stay in sync with src/data.js (client).
// 'matrix' is for rooms that are not bridged to one of the others (plain Matrix
// chats and the bridges' own bot rooms, where you log in to a bridge).
export const NETWORKS = [
  'instagram',
  'snapchat',
  'messages',
  'discord',
  'whatsapp',
  'messenger',
  'telegram',
  'slack',
  'matrix',
]

export const isNetwork = (value) => NETWORKS.includes(value)
