const test = require('node:test')
const assert = require('node:assert/strict')
const custom = require('./customizations.cjs')

const YT = 'custom-youtube-com'

test('YouTube added as an app gets the Hide Shorts option, on until switched off', () => {
  const all = custom.describeAll([YT, 'custom-notion-so'])
  assert.deepEqual(all[YT].map((o) => o.id), ['hideShorts'])
  assert.equal(all['custom-notion-so'], undefined)
  assert.deepEqual(custom.effective(YT, {}), { hideShorts: true })
  assert.deepEqual(custom.effective(YT, { hideShorts: false }), { hideShorts: false })
  assert.match(custom.buildCss(YT, {}), /ytd-reel-shelf-renderer/)
  assert.equal(custom.buildCss(YT, { hideShorts: false }), '')
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
