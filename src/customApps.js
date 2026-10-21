// Apps the user adds themselves: a service picked from the suggestions below, or
// any web address. They open in the desktop shell like the built-in web apps; the
// shell only lets one visit its own domain (see electron/networks.cjs).

// Popular services with the extra domains they sign in or load media from.
export const SUGGESTIONS = [
  { name: 'Bluesky', url: 'https://bsky.app/', hosts: ['bsky.social'], blurb: 'Posts and DMs' },
  { name: 'Threads', url: 'https://www.threads.net/', hosts: ['instagram.com', 'cdninstagram.com'], blurb: 'Posts' },
  { name: 'Pinterest', url: 'https://www.pinterest.com/', hosts: ['pinimg.com'], blurb: 'Boards and messages' },
  { name: 'Twitch', url: 'https://www.twitch.tv/', hosts: ['ttvnw.net', 'jtvnw.net'], blurb: 'Streams and chat' },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    hosts: ['ytimg.com', 'googlevideo.com', 'accounts.google.com', 'gstatic.com'],
    blurb: 'Videos',
  },
  {
    name: 'Google Chat',
    url: 'https://chat.google.com/',
    hosts: ['google.com', 'gstatic.com', 'googleusercontent.com'],
    blurb: 'Work chat',
  },
  {
    name: 'Google Voice',
    url: 'https://voice.google.com/',
    hosts: ['google.com', 'gstatic.com', 'googleusercontent.com'],
    blurb: 'Calls and texts',
  },
  {
    name: 'Skype',
    url: 'https://web.skype.com/',
    hosts: ['skype.com', 'live.com', 'microsoftonline.com', 'microsoft.com'],
    blurb: 'Calls and chat',
  },
  { name: 'Zoom', url: 'https://app.zoom.us/wc', hosts: ['zoom.us', 'zoom.com'], blurb: 'Meetings' },
  { name: 'Mastodon', url: 'https://mastodon.social/', hosts: [], blurb: 'Posts and messages' },
  { name: 'Tumblr', url: 'https://www.tumblr.com/', hosts: [], blurb: 'Blogs and messages' },
  { name: 'GitHub', url: 'https://github.com/', hosts: ['githubassets.com', 'githubusercontent.com'], blurb: 'Code' },
  { name: 'Notion', url: 'https://www.notion.so/', hosts: ['notion.com', 'accounts.google.com'], blurb: 'Notes and docs' },
  {
    name: 'Spotify',
    url: 'https://open.spotify.com/',
    hosts: ['spotify.com', 'scdn.co', 'accounts.google.com'],
    blurb: 'Music',
  },
  { name: 'Trello', url: 'https://trello.com/', hosts: ['atlassian.com', 'atlassian.net'], blurb: 'Boards' },
  { name: 'Asana', url: 'https://app.asana.com/', hosts: ['asana.com'], blurb: 'Tasks' },
]

const MAX_NAME = 40

export const hostOf = (url) => new URL(url).hostname.toLowerCase().replace(/^www\./, '')

// "custom-notion-so" for notion.so (stable, so the same site is the same app).
export const customId = (host) =>
  `custom-${host.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)}`

// "notion.so" -> "Notion", "app.example.co.uk" -> "App".
function nameFromHost(host) {
  const label = host.split('.')[0] || host
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// What was typed, as a web address: "notion.so", "www.notion.so/x" or a full https
// link. Returns a URL, or null if it isn't one (a plain name, spaces, an IP address,
// anything that is not https).
export function addressFromQuery(query) {
  const q = String(query ?? '').trim()
  if (!q || /\s/.test(q)) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(q) && !/^https:\/\//i.test(q)) return null
  try {
    const u = new URL(/^https:\/\//i.test(q) ? q : `https://${q}`)
    if (u.username || u.password || !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)) return null
    return u.toString()
  } catch {
    return null
  }
}

// An app record for a web address or a suggestion: { id, name, url, hosts }.
export function makeCustom({ name, url, hosts = [] }) {
  const host = hostOf(url)
  return {
    id: customId(host),
    name: String(name || nameFromHost(host)).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME),
    url,
    hosts,
  }
}

// Suggestions whose name contains the search, minus ones already added.
export function searchSuggestions(query, have = []) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return []
  const taken = new Set(have.map((a) => a.id))
  return SUGGESTIONS.filter((s) => s.name.toLowerCase().includes(q)).filter(
    (s) => !taken.has(makeCustom(s).id),
  )
}
