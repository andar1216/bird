import test from 'node:test'
import assert from 'node:assert/strict'
import { addressFromQuery, customId, makeCustom, searchSuggestions } from './customApps.js'

test('addresses are accepted with or without https', () => {
  assert.equal(addressFromQuery('notion.so'), 'https://notion.so/')
  assert.equal(addressFromQuery('https://www.example.com/app?x=1'), 'https://www.example.com/app?x=1')
})

test('only real https websites are taken as addresses', () => {
  for (const bad of ['', 'notion', 'two words.com', 'http://example.com', 'ftp://example.com', 'javascript:alert(1)', '192.168.0.1', 'localhost:3000', 'https://u:p@example.com']) {
    assert.equal(addressFromQuery(bad), null, bad)
  }
})

test('the same site gets the same id and a readable name', () => {
  const a = makeCustom({ url: 'https://www.notion.so/' })
  assert.equal(a.id, 'custom-notion-so')
  assert.equal(a.name, 'Notion')
  assert.equal(makeCustom({ url: 'https://notion.so/x' }).id, a.id)
  assert.equal(customId('app.example.co.uk'), 'custom-app-example-co-uk')
})

test('suggestions are found by name and skip ones already added', () => {
  assert.deepEqual(searchSuggestions('blue').map((s) => s.name), ['Bluesky'])
  assert.deepEqual(searchSuggestions('BLUE', [{ id: 'custom-bsky-app' }]), [])
  assert.deepEqual(searchSuggestions('  '), [])
})
