// One-click dev launcher for Bird.
//
// Starts whatever is not already running: MongoDB, the API server, the Vite dev
// server, then the Electron app. Edits show up live:
//   - src/*      -> Vite hot reload
//   - server/*   -> node --watch restarts the API
//   - electron/* -> this script restarts the Electron app
// When the Electron window is closed, everything this script started is stopped
// (services that were already running are left alone).
//
// Logs: logs/launcher.log, logs/mongod.log, logs/server.log, logs/vite.log, logs/electron.log
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, mkdirSync, watch } from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = join(root, 'server')
const logDir = join(root, 'logs')
mkdirSync(logDir, { recursive: true })

const PORT = { db: 27017, api: 4000, web: 5173 }
const WEB_URL = `http://localhost:${PORT.web}`

// ------------------------------------------------------------------ logging
const launcherLog = createWriteStream(join(logDir, 'launcher.log'), { flags: 'a' })
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)
  launcherLog.write(`${line}\n`)
}

// ------------------------------------------------------------------ helpers
const isUp = (port, host = '127.0.0.1') =>
  new Promise((done) => {
    const socket = net.connect({ port, host })
    socket.setTimeout(1000, () => socket.destroy())
    socket.once('connect', () => {
      socket.destroy()
      done(true)
    })
    socket.once('error', () => done(false))
    socket.once('close', () => done(false))
  })

async function waitFor(port, label, host, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isUp(port, host)) return
    await sleep(300)
  }
  throw new Error(`${label} did not come up on port ${port} (see logs/)`)
}

function killTree(proc) {
  if (!proc?.pid || proc.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true })
  } else {
    proc.kill('SIGTERM')
  }
}

// ----------------------------------------------------------------- services
const started = [] // services this script started, in start order

function startService(name, command, args, { cwd = root, env = {} } = {}) {
  const out = createWriteStream(join(logDir, `${name}.log`), { flags: 'a' })
  const proc = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.pipe(out, { end: false })
  proc.stderr.pipe(out, { end: false })
  proc.on('error', (err) => log(`${name} failed to start: ${err.message}`))
  proc.on('exit', (code) => log(`${name} exited (${code})`))
  started.push({ name, proc })
  log(`started ${name}`)
  return proc
}

async function stopMongo(entry) {
  // Ask mongod to shut down cleanly; fall back to killing it.
  spawnSync(
    'mongosh',
    ['--quiet', '--port', String(PORT.db), '--eval', "db.getSiblingDB('admin').shutdownServer()"],
    { windowsHide: true, timeout: 10_000 },
  )
  for (let i = 0; i < 25 && (await isUp(PORT.db)); i++) await sleep(300)
  if (await isUp(PORT.db)) killTree(entry.proc)
}

// ----------------------------------------------------------------- electron
const electronPath = createRequire(import.meta.url)('electron') // path to electron.exe
let electron = null
let restarting = false
let shuttingDown = false

function launchElectron() {
  const out = createWriteStream(join(logDir, 'electron.log'), { flags: 'a' })
  electron = spawn(electronPath, ['.'], {
    cwd: root,
    env: { ...process.env, BIRD_DEV_URL: WEB_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  electron.stdout.pipe(out, { end: false })
  electron.stderr.pipe(out, { end: false })
  electron.on('error', (err) => {
    log(`electron failed to start: ${err.message}`)
    shutdown()
  })
  electron.on('exit', (code) => {
    log(`electron exited (${code})`)
    if (restarting) {
      restarting = false
      launchElectron()
    } else {
      shutdown()
    }
  })
  log('started electron')
}

// Restart the app when its main-process files change (renderer hot-reloads itself).
function watchElectronFiles() {
  let timer
  watch(join(root, 'electron'), { recursive: true }, (_event, file) => {
    if (!file || !/\.(c|m)?js$/.test(file)) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (shuttingDown || !electron || electron.exitCode !== null) return
      log(`electron/${file} changed, restarting the app`)
      restarting = true
      killTree(electron)
    }, 300)
  })
}

// ----------------------------------------------------------------- shutdown
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  log('shutting down')
  killTree(electron)
  for (const entry of [...started].reverse()) {
    if (entry.name === 'mongod') await stopMongo(entry)
    else killTree(entry.proc)
  }
  log('bye')
  launcherLog.end(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// --------------------------------------------------------------------- main
async function main() {
  log('Bird launcher starting')

  const dbUp = await isUp(PORT.db)
  if (dbUp) log('MongoDB already running, reusing it')
  else startService('mongod', process.execPath, [join(serverDir, 'scripts', 'db.mjs')], { cwd: serverDir })

  const webUp = await isUp(PORT.web, 'localhost')
  if (webUp) log(`dev server already running on ${WEB_URL}, reusing it`)
  else {
    startService('vite', process.execPath, [
      join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--port',
      String(PORT.web),
      '--strictPort',
    ])
  }

  await waitFor(PORT.db, 'MongoDB')

  if (await isUp(PORT.api)) log('API server already running, reusing it')
  else {
    startService(
      'server',
      process.execPath,
      ['--watch', '--env-file-if-exists=.env', 'src/index.js'],
      { cwd: serverDir },
    )
  }

  await Promise.all([
    waitFor(PORT.api, 'API server'),
    waitFor(PORT.web, 'dev server', 'localhost'),
  ])

  watchElectronFiles()
  launchElectron()
}

main().catch(async (err) => {
  log(`launcher error: ${err.message}`)
  await shutdown()
})
