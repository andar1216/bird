// Per-app tweaks the user can switch on in the "Customize" panel.
//
// Deliberately limited to two low-risk mechanisms (no injected scripts):
//   - css:     hides parts of the page (applied with webContents.insertCSS)
//   - block / rewrite / start: rules on page *addresses*, which change far less
//     often than a site's markup.
// Tweaks that depend on a site's page layout can stop working when it changes.

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

function parse(rawUrl) {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function active(networkId, prefs) {
  const options = CUSTOMIZATIONS[networkId]?.options ?? []
  return options.filter((o) => prefs?.[o.id] === true)
}

/** What the UI may show: { [networkId]: [{ id, label, description }] }. */
function describeAll() {
  const out = {}
  for (const [networkId, { options }] of Object.entries(CUSTOMIZATIONS)) {
    out[networkId] = options.map(({ id, label, description }) => ({ id, label, description }))
  }
  return out
}

function hasOption(networkId, optionId) {
  return (CUSTOMIZATIONS[networkId]?.options ?? []).some((o) => o.id === optionId)
}

function buildCss(networkId, prefs) {
  return active(networkId, prefs)
    .map((o) => o.css)
    .filter(Boolean)
    .join('\n')
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

module.exports = { describeAll, hasOption, buildCss, isBlocked, rewriteUrl, startUrl }
