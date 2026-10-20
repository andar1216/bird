const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createUsageTracker } = require('./usage.cjs')

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bird-usage-')), 'usage.json')
const T0 = Date.UTC(2026, 9, 20, 12, 0, 0)
const sec = (n) => n * 1000

test('records a visit and reports it live while open', () => {
  const t = createUsageTracker(tmpFile())
  t.set({ u: 'me', a: 'discord' }, T0)
  const r = t.query('me', 0, T0 + sec(30))
  assert.deepEqual(r.active, { app: 'discord', start: T0 })
  assert.deepEqual(r.segments, [{ app: 'discord', start: T0, end: T0 + sec(30), live: true }])
  t.set(null, T0 + sec(60))
  const done = t.query('me', 0, T0 + sec(90))
  assert.equal(done.active, null)
  assert.deepEqual(done.segments, [{ app: 'discord', start: T0, end: T0 + sec(60), live: false }])
})

test('switching apps closes one visit and opens the next', () => {
  const t = createUsageTracker(tmpFile())
  t.set({ u: 'me', a: 'discord' }, T0)
  t.set({ u: 'me', a: 'instagram' }, T0 + sec(100))
  t.set(null, T0 + sec(200))
  const apps = t.query('me', 0, T0 + sec(300)).segments.map((s) => [s.app, s.end - s.start])
  assert.deepEqual(apps, [['discord', sec(100)], ['instagram', sec(100)]])
})

test('drops blips and merges quick returns to the same app', () => {
  const t = createUsageTracker(tmpFile())
  t.set({ u: 'me', a: 'discord' }, T0)
  t.set(null, T0 + sec(60))
  t.set({ u: 'me', a: 'discord' }, T0 + sec(65)) // menu closed again after 5s
  t.set(null, T0 + sec(125))
  t.set({ u: 'me', a: 'discord' }, T0 + sec(400))
  t.set(null, T0 + sec(401)) // 1s: ignored
  const segs = t.query('me', 0, T0 + sec(500)).segments
  assert.equal(segs.length, 1)
  assert.equal(segs[0].end - segs[0].start, sec(125))
})

test('each account only sees its own time', () => {
  const t = createUsageTracker(tmpFile())
  t.set({ u: 'me', a: 'discord' }, T0)
  t.set(null, T0 + sec(60))
  assert.equal(t.query('someone-else', 0, T0 + sec(70)).segments.length, 0)
})

test('saves to disk, including the visit in progress, and reloads', () => {
  const file = tmpFile()
  const a = createUsageTracker(file)
  a.set({ u: 'me', a: 'discord' }, T0)
  a.save(T0 + sec(45)) // pretend the app crashed right after this
  const b = createUsageTracker(file)
  b.load(T0 + sec(50))
  assert.deepEqual(b.query('me', 0, T0 + sec(50)).segments, [
    { app: 'discord', start: T0, end: T0 + sec(45), live: false },
  ])
})

test('forgets visits older than 90 days and survives a corrupt file', () => {
  const file = tmpFile()
  const day = 24 * 60 * 60 * 1000
  fs.writeFileSync(
    file,
    JSON.stringify([
      { u: 'me', a: 'discord', s: T0 - 100 * day, e: T0 - 100 * day + sec(60) },
      { u: 'me', a: 'discord', s: T0 - day, e: T0 - day + sec(60) },
      { nonsense: true },
    ]),
  )
  const t = createUsageTracker(file)
  t.load(T0)
  assert.equal(t.query('me', 0, T0).segments.length, 1)
  fs.writeFileSync(file, '{not json')
  t.load(T0)
  assert.equal(t.query('me', 0, T0).segments.length, 0)
})

test('screen-time helpers: clipping, per-day totals, formatting', async () => {
  const s = await import('../src/usageStats.js')
  const midnight = new Date(2026, 9, 20).getTime()
  const hour = 3600_000
  // 23:00 yesterday -> 01:00 today, so one hour on each day
  const segs = [{ app: 'discord', start: midnight - hour, end: midnight + hour }]
  const days = s.perDay(segs, 2, midnight + 5 * hour)
  assert.equal(days[0].perApp.discord, hour)
  assert.equal(days[1].perApp.discord, hour)
  assert.equal(s.formatDuration(sec(42)), '42s')
  assert.equal(s.formatDuration(sec(12 * 60 + 4)), '12m 04s')
  assert.equal(s.formatDuration(sec(65 * 60)), '1h 05m')
  const r = s.timelineRange([{ app: 'x', start: midnight + 14 * hour + 600_000, end: midnight + 14 * hour + 900_000 }], midnight)
  assert.ok(r.to - r.from >= 6 * hour && r.from <= midnight + 14 * hour && r.to >= midnight + 15 * hour)
})
