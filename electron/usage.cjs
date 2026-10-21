const fs = require('node:fs')
const path = require('node:path')

// Screen time per app: how long each app was actually on screen (its web view
// visible, Bird focused, and you not idle). Stored on this device only, as a
// list of segments { u: bird user id, a: app id, s: start ms, e: end ms }.
const KEEP_MS = 90 * 24 * 60 * 60 * 1000
const MIN_MS = 2_000 // ignore blips shorter than this
const MERGE_GAP_MS = 10_000 // a menu opened and closed again is still one visit
const MAX_OPENS = 20_000
// Bird's own open time is kept in the same list under this name: the time the Bird
// window is up (not minimized), whichever app is showing and even when it is
// not the front window. Not an app, so it is reported apart from the apps.
const BIRD = '@bird'

// Opens are counted separately from time: each time you open an app from its icon
// (via 'app') or through one of its conversations in All Chats (via 'chat').
const VIA = new Set(['app', 'chat'])

function createUsageTracker(file) {
  /** @type {{u: string, a: string, s: number, e: number}[]} */
  let segments = []
  /** @type {{u: string, a: string, s: number} | null} */
  let open = null
  /** Bird itself being open: the same shape, kept apart from the app on screen. */
  let birdOpen = null
  /** @type {{u: string, a: string, t: number, v: string}[]} */
  let opens = []
  const opensFile = file.replace(/(\.json)?$/, '-opens.json')

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
    try {
      const raw = JSON.parse(fs.readFileSync(opensFile, 'utf8'))
      opens = (Array.isArray(raw) ? raw : []).filter(
        (x) => x && typeof x.u === 'string' && typeof x.a === 'string' && VIA.has(x.v) && Number.isFinite(x.t) && x.t >= now - KEEP_MS,
      )
    } catch {
      opens = []
    }
  }

  // Note that an app was opened. Returns false for a source it doesn't know.
  function recordOpen(userId, app, via, now = Date.now()) {
    if (!userId || typeof app !== 'string' || !VIA.has(via)) return false
    opens.push({ u: userId, a: app, t: now, v: via })
    if (opens.length > MAX_OPENS) opens = opens.slice(-MAX_OPENS)
    return true
  }

  function finish(visit, now) {
    const seg = { u: visit.u, a: visit.a, s: visit.s, e: now }
    if (seg.e - seg.s < MIN_MS) return
    // Join the previous visit to the same app when it just ended (two things can
    // be open at once, so it is not always the very last entry).
    let last = null
    for (let i = segments.length - 1; i >= 0 && segments[i].e >= seg.s - MERGE_GAP_MS; i--) {
      if (segments[i].u === seg.u && segments[i].a === seg.a) {
        last = segments[i]
        break
      }
    }
    if (last) last.e = Math.max(last.e, seg.e)
    else segments.push(seg)
  }

  function close(now) {
    if (!open) return
    const visit = open
    open = null
    finish(visit, now)
  }

  // Say what is on screen right now: { u, a }, or null when nothing is.
  function set(target, now = Date.now()) {
    if (open && target && open.u === target.u && open.a === target.a) return
    if (!open && !target) return
    close(now)
    if (target) open = { u: target.u, a: target.a, s: now }
  }

  // Say whether Bird itself is open for this account: { u }, or null when it is not
  // (minimized, hidden, or nobody signed in).
  function setBirdOpen(target, now = Date.now()) {
    if (birdOpen && target && birdOpen.u === target.u) return
    if (!birdOpen && !target) return
    if (birdOpen) {
      const visit = birdOpen
      birdOpen = null
      finish(visit, now)
    }
    if (target) birdOpen = { u: target.u, a: BIRD, s: now }
  }

  // Write to disk. The visit in progress is saved too (up to now), so a crash
  // loses at most a few seconds.
  function save(now = Date.now()) {
    const out = [...segments]
    for (const visit of [open, birdOpen]) {
      if (visit && now - visit.s >= MIN_MS) out.push({ ...visit, e: now })
    }
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(out))
      fs.renameSync(tmp, file)
      const tmp2 = `.tmp`
      fs.writeFileSync(tmp2, JSON.stringify(opens))
      fs.renameSync(tmp2, opensFile)
    } catch (err) {
      console.error('[usage] could not save', err)
    }
  }

  // One account's visits that end after `since`, plus the one in progress.
  function query(userId, since, now = Date.now()) {
    const mineAll = segments
      .filter((x) => x.u === userId && x.e > since)
      .map((x) => ({ app: x.a, start: x.s, end: x.e, live: false }))
    let active = null
    const out = mineAll.filter((x) => x.app !== BIRD)
    const birdTime = mineAll.filter((x) => x.app === BIRD).map(({ start, end, live }) => ({ start, end, live }))
    if (open && open.u === userId) {
      active = { app: open.a, start: open.s }
      out.push({ app: open.a, start: open.s, end: now, live: true })
    }
    if (birdOpen && birdOpen.u === userId) birdTime.push({ start: birdOpen.s, end: now, live: true })
    const mine = opens.filter((x) => x.u === userId && x.t >= since).map((x) => ({ app: x.a, at: x.t, via: x.v }))
    return { now, segments: out, active, opens: mine, birdOpen: birdTime }
  }

  return { load, set, setBirdOpen, save, query, recordOpen }
}

module.exports = { createUsageTracker, MIN_MS, MERGE_GAP_MS }
