/* global window, document, location */
// Ad blocking for YouTube, run inside the YouTube page before its own scripts (see
// network-preload.cjs). Three layers, since YouTube changes how it serves ads often:
//   1. take the ad lists out of the data the player is given, so it has none to play;
//   2. if an ad plays anyway, skip it (click Skip, or jump to its end, muted);
//   3. close the "ad blockers are not allowed" box if YouTube shows one.
// Page elements for ads are hidden by CSS (see customizations.cjs). Best effort: it
// can stop working when YouTube changes.

function adblockInPage() {
  if (!/(^|\.)youtube\.com$/.test(location.hostname) || window.__birdAdblock) return
  window.__birdAdblock = true

  const LISTS = ['adPlacements', 'playerAds', 'adSlots']

  // Remove the ads from a player/next response (wherever they are nested one level down).
  const strip = (o) => {
    if (!o || typeof o !== 'object') return o
    try {
      for (const key of LISTS) if (key in o) o[key] = []
      if ('adBreakHeartbeatParams' in o) delete o.adBreakHeartbeatParams
      if (o.playerResponse && typeof o.playerResponse === 'object') strip(o.playerResponse)
      if (o.response && typeof o.response === 'object') strip(o.response)
    } catch {
      /* leave it as it was */
    }
    return o
  }

  // 1a. The first player data is placed in the page by an inline script.
  try {
    let initial
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: () => initial,
      set: (value) => {
        initial = strip(value)
      },
    })
  } catch {
    /* already defined */
  }

  // 1b. Later data comes from JSON the page reads.
  const parse = JSON.parse
  JSON.parse = function (...args) {
    const result = parse.apply(this, args)
    if (result && typeof result === 'object' && ('adPlacements' in result || 'playerResponse' in result || 'playerAds' in result)) {
      strip(result)
    }
    return result
  }
  const json = Response.prototype.json
  Response.prototype.json = async function () {
    const result = await json.call(this)
    try {
      if (typeof this.url === 'string' && this.url.includes('/youtubei/v1/')) strip(result)
    } catch {
      /* ignore */
    }
    return result
  }

  // 2 and 3. If an ad shows anyway, get past it; and remove the "ad blocker" box.
  let before = null // the player's sound and speed before an ad, put back after it
  const tick = () => {
    const player = document.querySelector('#movie_player')
    const video = document.querySelector('video.html5-main-video')
    const ad = Boolean(player && player.classList.contains('ad-showing'))

    if (ad && video) {
      if (!before) before = { muted: video.muted, rate: video.playbackRate }
      video.muted = true
      const skip = document.querySelector(
        '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button',
      )
      if (skip) skip.click()
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration
      video.playbackRate = 16
    } else if (before && video) {
      video.muted = before.muted
      video.playbackRate = before.rate
      before = null
    }

    const close = document.querySelector('.ytp-ad-overlay-close-button')
    if (close) close.click()

    const notice = document.querySelector('ytd-enforcement-message-view-model')
    if (notice) {
      const box = notice.closest('tp-yt-paper-dialog') || notice
      box.remove()
      document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach((el) => el.remove())
      if (video && video.paused) video.play().catch(() => {})
    }
  }
  setInterval(() => {
    if (!document.hidden) tick()
  }, 300)
}

const ADBLOCK_SCRIPT = `(${adblockInPage.toString()})()`

// Elements that are ads: banners, feed and search ads, sponsored cards, the video
// player's ad layers, and the "ad blockers" notice.
const ADBLOCK_CSS =
  [
    '#masthead-ad',
    '#player-ads',
    '.video-ads.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-image-overlay',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-display-ad-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-brand-video-singleton-renderer',
    'ytd-brand-video-shelf-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-sparkles-text-search-renderer',
    'ytd-promoted-video-renderer',
    'ytd-compact-promoted-video-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-companion-slot-renderer',
    'ytd-player-legacy-desktop-watch-ads-renderer',
    'ytd-primetime-promo-renderer',
    'yt-mealbar-promo-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)',
    'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
    'ytd-rich-section-renderer:has(ytd-ad-slot-renderer)',
    'ytd-search-pyv-renderer',
    'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    'ytd-enforcement-message-view-model',
  ].join(',\n') + ' { display: none !important; }'

// Requests that only serve ads.
const ADBLOCK_REQUESTS = [
  '*://googleads.g.doubleclick.net/*',
  '*://*.doubleclick.net/*',
  '*://*.googlesyndication.com/*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/get_midroll_info*',
  '*://*.youtube.com/pcs/activeview*',
]

module.exports = { ADBLOCK_SCRIPT, ADBLOCK_CSS, ADBLOCK_REQUESTS }
