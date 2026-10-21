import test from 'node:test'
import assert from 'node:assert/strict'
import { opensByApp } from './usageStats.js'

test('opens are counted per app, with and without the ones made through chats', () => {
  const opens = [
    { app: 'discord', at: 100, via: 'app' },
    { app: 'discord', at: 200, via: 'chat' },
    { app: 'discord', at: 300, via: 'chat' },
    { app: 'snapchat', at: 150, via: 'app' },
    { app: 'snapchat', at: 5000, via: 'app' }, // outside the window
  ]
  assert.deepEqual(opensByApp(opens, 0, 1000), {
    discord: { app: 1, chat: 2, all: 3 },
    snapchat: { app: 1, chat: 0, all: 1 },
  })
  assert.deepEqual(opensByApp(undefined, 0, 1), {})
})
