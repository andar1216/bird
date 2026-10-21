// Per-app tweaks the user can switch on in the "Customize" panel.
//
// Mechanisms, from least to most involved:
//   - css:     hides parts of the page (applied with webContents.insertCSS)
//   - block / rewrite / start: rules on page *addresses*, which change far less
//     often than a site's markup.
//   - requests: web addresses the page may not load at all (ad servers)
//   - script:  code run in the page before its own scripts (used only where CSS and
//     addresses can't do it, e.g. skipping video ads)
// Tweaks that depend on a site's page layout can stop working when it changes.

const { ADBLOCK_SCRIPT, ADBLOCK_CSS, ADBLOCK_REQUESTS } = require('./youtube-adblock.cjs')

// An option may be `defaultOn`: it applies until the user switches it off.

const INSTAGRAM_HOME = 'https://www.instagram.com/'
const INSTAGRAM_FOLLOWING = `${INSTAGRAM_HOME}?variant=following`

const CUSTOMIZATIONS = {
  instagram: {
    options: [
      {
        id: 'hideReels',
        label: 'Hide Reels',
        description: 'Removes the Reels buttons and tabs, and stops Reels pages from opening.',
        css: 'div:has(> a[href="/reels/"]), a[href$="/reels/"] { display: none !important; }',
        // /reels, /reel/<id>, and a profile's /<user>/reels/ tab.
        block: (u) => /^\/reels?(\/|$)/.test(u.pathname) || /^\/[^/]+\/reels\/?$/.test(u.pathname),
      },
      {
        id: 'hideExplore',
        label: 'Hide Explore',
        description: 'Removes the Explore button and the Explore page of suggested posts.',
        css: 'div:has(> a[href="/explore/"]), a[href="/explore/"] { display: none !important; }',
        block: (u) => /^\/explore\/?$/.test(u.pathname),
      },
      {
        id: 'followingOnly',
        label: 'Following feed only',
        description: 'Home shows posts from accounts you follow, with no suggested posts. Stories stay.',
        start: INSTAGRAM_FOLLOWING,
        // Instagram's Home button goes to "/", which is the mixed feed.
        rewrite: (u) =>
          u.pathname === '/' && !u.searchParams.has('variant') ? INSTAGRAM_FOLLOWING : null,
      },
    ],
  },
}

// Shorts: the shelves and menu entries, any video card that links to a Short, and the
// Shorts tab on channels.
const YOUTUBE_SHORTS_CSS = [
  'ytd-reel-shelf-renderer',
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
  // The menu entries (the narrow one on the home page has the label on its link).
  'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
  'ytd-guide-entry-renderer:has(a[title="Shorts"])',
  'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
  'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
  'ytd-mini-guide-entry-renderer:has(a[aria-label="Shorts"])',
  'yt-tab-shape[tab-title="Shorts"]',
  'tp-yt-paper-tab:has(> .tab-content[title="Shorts"])',
  'yt-chip-cloud-chip-renderer:has(a[href^="/shorts"])',
  'ytd-video-renderer:has(a[href^="/shorts/"])',
  'ytd-grid-video-renderer:has(a[href^="/shorts/"])',
  'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
  'ytd-compact-video-renderer:has(a[href^="/shorts/"])',
  'yt-lockup-view-model:has(a[href^="/shorts/"])',
  'ytm-shorts-lockup-view-model',
].join(',\n') + ' { display: none !important; }'

CUSTOMIZATIONS.youtube = {
  options: [
    {
      id: 'hideShorts',
      label: 'Hide Shorts',
      description: 'Removes Shorts from the menu, the feed, search and channels. Shorts pages do not open.',
      defaultOn: true,
      css: YOUTUBE_SHORTS_CSS,
      // The Shorts feed, any single Short, and a channel's Shorts tab.
      block: (u) =>
        /^\/shorts(\/|$)/.test(u.pathname) ||
        /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/shorts\/?$/.test(u.pathname),
    },
    {
      id: 'blockAds',
      label: 'Block ads',
      description: 'Hides ad banners and ads in the feed, search and beside videos, and skips the ads in and before videos.',
      defaultOn: true,
      css: ADBLOCK_CSS,
      script: ADBLOCK_SCRIPT,
      requests: ADBLOCK_REQUESTS,
    },
  ],
}

// The set of tweaks that applies to an app. YouTube is added by the user as an app of
// its own (id like "custom-youtube-com"), so it is recognised by that id.
function keyOf(networkId) {
  if (CUSTOMIZATIONS[networkId]) return networkId
  if (/^custom-(www-|m-)?youtube-com$/.test(String(networkId))) return 'youtube'
  return null
}

const optionsOf = (networkId) => CUSTOMIZATIONS[keyOf(networkId)]?.options ?? []
const isOn = (o, prefs) => (typeof prefs?.[o.id] === 'boolean' ? prefs[o.id] : o.defaultOn === true)

function parse(rawUrl) {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function active(networkId, prefs) {
  return optionsOf(networkId).filter((o) => isOn(o, prefs))
}

/** What the UI may show: { [networkId]: [{ id, label, description }] }, for the apps given. */
function describeAll(networkIds = []) {
  const out = {}
  for (const networkId of new Set([...Object.keys(CUSTOMIZATIONS), ...networkIds])) {
    const options = optionsOf(networkId)
    if (options.length) out[networkId] = options.map(({ id, label, description }) => ({ id, label, description }))
  }
  return out
}

function hasOption(networkId, optionId) {
  return optionsOf(networkId).some((o) => o.id === optionId)
}

/** Every option's current on/off for an app, counting what is on by default. */
function effective(networkId, prefs) {
  return Object.fromEntries(optionsOf(networkId).map((o) => [o.id, isOn(o, prefs)]))
}

/** What to keep in the saved prefs: nothing when the value is the option's default. */
function stored(networkId, optionId, value) {
  const o = optionsOf(networkId).find((x) => x.id === optionId)
  return o && value === (o.defaultOn === true) ? undefined : value
}

function buildCss(networkId, prefs) {
  return active(networkId, prefs)
    .map((o) => o.css)
    .filter(Boolean)
    .join('\n')
}

/** Code to run in a page before its own scripts ('' when no option needs any). */
function scriptFor(networkId, prefs) {
  return active(networkId, prefs)
    .map((o) => o.script)
    .filter(Boolean)
    .join('\n')
}

/** Whether switching this option needs the page reloaded (it runs a script). */
function hasScript(networkId, optionId) {
  return optionsOf(networkId).some((o) => o.id === optionId && o.script)
}

// "*://*.example.com/path*" -> a RegExp.
function patternToRegExp(pattern) {
  const body = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${body}$`, 'i')
}

/** Every address pattern an app's options may block (whether or not they are on now). */
function requestPatterns(networkId) {
  return [...new Set(optionsOf(networkId).flatMap((o) => o.requests ?? []))]
}

/** True if an option that is on blocks this request. */
function blocksRequest(networkId, prefs, rawUrl) {
  return active(networkId, prefs).some((o) => (o.requests ?? []).some((p) => patternToRegExp(p).test(rawUrl)))
}

/** True if the page at this address should not be shown. */
function isBlocked(networkId, prefs, rawUrl) {
  const u = parse(rawUrl)
  return Boolean(u) && active(networkId, prefs).some((o) => o.block?.(u))
}

/** An address to load instead of this one, or null. */
function rewriteUrl(networkId, prefs, rawUrl) {
  const u = parse(rawUrl)
  if (!u) return null
  for (const o of active(networkId, prefs)) {
    const to = o.rewrite?.(u)
    if (to) return to
  }
  return null
}

/** The address a freshly opened app should start on, or null for its default. */
function startUrl(networkId, prefs) {
  return active(networkId, prefs).find((o) => o.start)?.start ?? null
}

module.exports = {
  describeAll,
  hasOption,
  effective,
  stored,
  buildCss,
  scriptFor,
  hasScript,
  requestPatterns,
  blocksRequest,
  isBlocked,
  rewriteUrl,
  startUrl,
}
