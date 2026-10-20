// Must stay in sync with src/data.js (client) and electron/networks.cjs.
export const NETWORKS = ['instagram', 'snapchat', 'messages', 'discord']

export const isNetwork = (value) => NETWORKS.includes(value)
