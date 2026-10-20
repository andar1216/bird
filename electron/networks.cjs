// Single source of truth for the networks the desktop shell can host.
// `hosts` are the only domains a network's view may navigate to (including
// subdomains). Anything else is opened in the user's default browser.
const NETWORKS = {
  instagram: {
    name: 'Instagram',
    url: 'https://www.instagram.com/direct/inbox/',
    // facebook.com is allowed so "Continue with Facebook" login stays in-session.
    hosts: ['instagram.com', 'cdninstagram.com', 'facebook.com'],
  },
  snapchat: {
    name: 'Snapchat',
    url: 'https://web.snapchat.com/',
    hosts: ['snapchat.com'],
  },
  messages: {
    name: 'Google Messages',
    url: 'https://messages.google.com/web',
    hosts: ['google.com', 'gstatic.com'],
  },
  discord: {
    name: 'Discord',
    url: 'https://discord.com/app',
    hosts: ['discord.com', 'discordapp.com'],
  },

  // ---- Web-only apps users can add with the "+" button (see src/data.js).
  // Login pages for some of these live on shared identity domains, so those
  // are listed too; everything else opens in the default browser.
  whatsapp: {
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com/',
    hosts: ['whatsapp.com', 'whatsapp.net'],
  },
  messenger: {
    name: 'Messenger',
    url: 'https://www.messenger.com/',
    hosts: ['messenger.com', 'facebook.com', 'fbcdn.net', 'fbsbx.com'],
  },
  facebook: {
    name: 'Facebook',
    url: 'https://www.facebook.com/',
    hosts: ['facebook.com', 'fbcdn.net', 'fbsbx.com'],
  },
  x: {
    name: 'X',
    url: 'https://x.com/messages',
    hosts: ['x.com', 'twitter.com', 'twimg.com'],
  },
  telegram: {
    name: 'Telegram',
    url: 'https://web.telegram.org/a/',
    hosts: ['telegram.org'],
  },
  slack: {
    name: 'Slack',
    url: 'https://app.slack.com/client',
    hosts: ['slack.com', 'slack-edge.com', 'slack-imgs.com'],
  },
  teams: {
    name: 'Microsoft Teams',
    url: 'https://teams.microsoft.com/',
    hosts: [
      'microsoft.com',
      'microsoftonline.com',
      'microsoft365.com',
      'office.com',
      'live.com',
      'skype.com',
    ],
  },
  linkedin: {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/messaging/',
    hosts: ['linkedin.com', 'licdn.com'],
  },
  tiktok: {
    name: 'TikTok',
    url: 'https://www.tiktok.com/messages',
    hosts: ['tiktok.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com'],
  },
  gmail: {
    name: 'Gmail',
    url: 'https://mail.google.com/',
    hosts: ['google.com', 'gstatic.com', 'googleusercontent.com'],
  },
}

// Permissions a network page may be granted (only while on its own hosts).
const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'fullscreen',
  'clipboard-sanitized-write',
])

function hostMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function isAllowedUrl(networkId, rawUrl) {
  const net = NETWORKS[networkId]
  if (!net) return false
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== 'https:') return false
    return net.hosts.some((d) => hostMatches(u.hostname, d))
  } catch {
    return false
  }
}

// Unread info is derived from the page title only, e.g. "(3) Discord" or
// "• Discord". No DOM access or script injection.
function parseBadge(title) {
  const t = (title || '').trim()
  const m = /^[([](\d+)[)\]]/.exec(t)
  if (m) return { count: parseInt(m[1], 10), dot: false }
  if (/^[•●]/.test(t)) return { count: 0, dot: true }
  return { count: 0, dot: false }
}

module.exports = { NETWORKS, ALLOWED_PERMISSIONS, isAllowedUrl, parseBadge }
