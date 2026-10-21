const test = require('node:test')
const assert = require('node:assert/strict')
const { NETWORKS, isAllowedUrl, normalizeCustom, setCustomNetworks } = require('./networks.cjs')

test('Reddit is a built-in app limited to its own domains', () => {
  assert.ok(NETWORKS.reddit)
  assert.equal(isAllowedUrl('reddit', 'https://www.reddit.com/r/all'), true)
  assert.equal(isAllowedUrl('reddit', 'https://chat.reddit.com/'), true)
  assert.equal(isAllowedUrl('reddit', 'https://evil.example.com/'), false)
  assert.equal(isAllowedUrl('reddit', 'http://www.reddit.com/'), false)
})

test('added apps must be https websites with a real domain name', () => {
  const ok = { id: 'custom-notion-so', name: 'Notion', url: 'https://www.notion.so/' }
  assert.deepEqual(normalizeCustom(ok).hosts, ['notion.so'])
  for (const bad of [
    { ...ok, url: 'http://notion.so/' },
    { ...ok, url: 'https://127.0.0.1/' },
    { ...ok, url: 'https://localhost/' },
    { ...ok, url: 'https://user:pw@notion.so/' },
    { ...ok, id: 'notion' },
    { ...ok, id: 'custom-' },
    { ...ok, name: '   ' },
    null,
  ]) {
    assert.equal(normalizeCustom(bad), null)
  }
})

test('an added app may only visit its own site and the extra login domains it names', () => {
  setCustomNetworks([
    { id: 'custom-notion-so', name: 'Notion', url: 'https://www.notion.so/', hosts: ['accounts.google.com', 'not a host', '1.2.3.4'] },
  ])
  assert.equal(isAllowedUrl('custom-notion-so', 'https://www.notion.so/page'), true)
  assert.equal(isAllowedUrl('custom-notion-so', 'https://accounts.google.com/signin'), true)
  assert.equal(isAllowedUrl('custom-notion-so', 'https://other.example.com/'), false)
  assert.deepEqual(NETWORKS['custom-notion-so'].hosts, ['notion.so', 'accounts.google.com'])
})

test('replacing the added apps drops the old ones and never touches built-ins', () => {
  setCustomNetworks([{ id: 'custom-a-com', name: 'A', url: 'https://a.com/' }])
  const dropped = setCustomNetworks([{ id: 'custom-b-com', name: 'B', url: 'https://b.com/' }])
  assert.deepEqual(dropped, ['custom-a-com'])
  assert.ok(NETWORKS['custom-b-com'] && !NETWORKS['custom-a-com'])
  assert.ok(NETWORKS.instagram && NETWORKS.reddit)
  setCustomNetworks([])
  assert.equal(Object.keys(NETWORKS).some((id) => id.startsWith('custom-')), false)
})
