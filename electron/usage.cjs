const fs = require('node:fs')
const path = require('node:path')

// Screen time per app: how long each app was actually on screen (its web view
// visible, Bird focused, and you not idle). Stored on this device only, as a
// list of segments { u: bird user id, a: app id, s: start ms, e: end ms }.
const KEEP_MS = 90 * 24 * 60 * 60 * 1000
const MIN_MS = 2_000 // ignore blips shorter than this
const MERGE_GAP_MS = 10_000 // a menu opened and closed again is still one visit

function createUsageTracker(file) {
  /** @type {{u: string, a: string, s: number, e: number}[]} */
  let segments = []
  /** @type {{u: string, a: string, s: number} | null} */
  let open = null

  function load(now = Date.now()) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      segments = (Array.isArray(raw) ? raw : []).filter(
        (x) =>
          x &&
          typeof x.u === 'string' &&
          typeof x.a === 'string' &&
          Number.isFinite(x.s) &&
          Number.isFinite(x.e) &&
          x.e > x.s &&
          x.e >= now - KEEP_MS,
      )
    } catch {
      segments = []
    }
  }

  function close(now) {
    if (!open) return
    const seg = { u: open.u, a: open.a, s: open.s, e: now }
    open = null
    if (seg.e - seg.s < MIN_MS) return
    const last = segments[segments.length - 1]
    if (last && last.u === seg.u && last.a === seg.a && seg.s - last.e <= MERGE_GAP_MS) {
      last.e = seg.e
    } else {
      segments.push(seg)
    }
  }

  // Say what is on screen right now: { u, a }, or null when nothing is.
  function set(target, now = Date.now()) {
    if (open && target && open.u === target.u && open.a === target.a) return
    if (!open && !target) return
    close(now)
    if (target) open = { u: target.u, a: target.a, s: now }
  }

  // Write to disk. The visit in progress is saved too (up to now), so a crash
  // loses at most a few seconds.
  function save(now = Date.now()) {
    const out = open && now - open.s >= MIN_MS ? [...segments, { ...open, e: now }] : segments
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(out))
      fs.renameSync(tmp, file)
    } catch (err) {
      console.error('[usage] could not save', err)
    }
  }

  // One account's visits that end after `since`, plus the one in progress.
  function query(userId, since, now = Date.now()) {
    const out = segments
      .filter((x) => x.u === userId && x.e > since)
      .map((x) => ({ app: x.a, start: x.s, end: x.e, live: false }))
    let active = null
    if (open && open.u === userId) {
      active = { app: open.a, start: open.s }
      out.push({ app: open.a, start: open.s, end: now, live: true })
    }
    return { now, segments: out, active }
  }

  return { load, set, save, query }
}

module.exports = { createUsageTracker, MIN_MS, MERGE_GAP_MS }
