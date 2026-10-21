const test = require('node:test')
const assert = require('node:assert/strict')
const custom = require('./customizations.cjs')

const YT = 'custom-youtube-com'

test('YouTube added as an app gets the Hide Shorts option, on until switched off', () => {
  const all = custom.describeAll([YT, 'custom-notion-so'])
  assert.deepEqual(all[YT].map((o) => o.id), ['hideShorts', 'blockAds'])
  assert.equal(all['custom-notion-so'], undefined)
  assert.deepEqual(custom.effective(YT, {}), { hideShorts: true, blockAds: true })
  assert.deepEqual(custom.effective(YT, { hideShorts: false }), { hideShorts: false, blockAds: true })
  assert.match(custom.buildCss(YT, {}), /ytd-reel-shelf-renderer/)
  assert.doesNotMatch(custom.buildCss(YT, { hideShorts: false }), /ytd-reel-shelf-renderer/)
})

test('only a choice that differs from the default is stored', () => {
  assert.equal(custom.stored(YT, 'hideShorts', true), undefined)
  assert.equal(custom.stored(YT, 'hideShorts', false), false)
  assert.equal(custom.stored('instagram', 'hideReels', true), true)
  assert.equal(custom.stored('instagram', 'hideReels', false), undefined)
  assert.equal(custom.hasOption(YT, 'hideShorts'), true)
  assert.equal(custom.hasOption('custom-notion-so', 'hideShorts'), false)
})

test('every Shorts page is blocked, and nothing is rewritten', () => {
  for (const path of ['shorts', 'shorts/', 'shorts/aBcDeFg1234', '@someone/shorts', 'channel/UC123/shorts']) {
    assert.equal(custom.isBlocked(YT, {}, `https://www.youtube.com/${path}`), true, path)
    assert.equal(custom.isBlocked(YT, { hideShorts: false }, `https://www.youtube.com/${path}`), false, path)
  }
  assert.equal(custom.isBlocked(YT, {}, 'https://www.youtube.com/watch?v=abc'), false)
  assert.equal(custom.isBlocked(YT, {}, 'https://www.youtube.com/@someone/videos'), false)
  assert.equal(custom.rewriteUrl(YT, {}, 'https://www.youtube.com/shorts/aBcDeFg1234'), null)
})
test('Instagram options stay off until switched on', () => {
  assert.deepEqual(custom.effective('instagram', {}), { hideReels: false, hideExplore: false, followingOnly: false })
  assert.equal(custom.isBlocked('instagram', {}, 'https://www.instagram.com/reels/'), false)
  assert.equal(custom.isBlocked('instagram', { hideReels: true }, 'https://www.instagram.com/reels/'), true)
})

test('YouTube ad blocking is on by default and can be switched off', () => {
  assert.match(custom.buildCss(YT, {}), /ytd-ad-slot-renderer/)
  assert.equal(custom.buildCss(YT, { hideShorts: false, blockAds: false }), '')
  // The in-page script is valid code, only given when the option is on.
  const code = custom.scriptFor(YT, {})
  assert.ok(code.length > 200)
  assert.doesNotThrow(() => new Function(code))
  assert.equal(custom.scriptFor(YT, { blockAds: false }), '')
  assert.equal(custom.scriptFor('instagram', {}), '')
  assert.equal(custom.hasScript(YT, 'blockAds'), true)
  assert.equal(custom.hasScript(YT, 'hideShorts'), false)
})

test('requests that only serve ads are blocked while the option is on', () => {
  assert.ok(custom.requestPatterns(YT).length > 0)
  assert.deepEqual(custom.requestPatterns('instagram'), [])
  const ad = 'https://googleads.g.doubleclick.net/pagead/id?x=1'
  assert.equal(custom.blocksRequest(YT, {}, ad), true)
  assert.equal(custom.blocksRequest(YT, {}, 'https://www.youtube.com/pagead/viewthroughconversion/1/'), true)
  assert.equal(custom.blocksRequest(YT, {}, 'https://www.youtube.com/watch?v=abc'), false)
  assert.equal(custom.blocksRequest(YT, {}, 'https://rr1---sn.googlevideo.com/videoplayback?id=1'), false)
  assert.equal(custom.blocksRequest(YT, { blockAds: false }, ad), false)
})
