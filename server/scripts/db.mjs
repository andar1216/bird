// Starts a local mongod with its data kept inside the project (server/.data),
// so no admin rights or Windows service are needed.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = resolve(process.env.MONGO_DBPATH ?? join(root, '.data'))
const port = process.env.MONGO_PORT ?? '27017'

function findMongod() {
  if (process.env.MONGOD_PATH) return process.env.MONGOD_PATH
  if (process.platform === 'win32') {
    const base = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'MongoDB', 'Server')
    if (existsSync(base)) {
      const versions = readdirSync(base).sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true }),
      )
      for (const v of versions) {
        const exe = join(base, v, 'bin', 'mongod.exe')
        if (existsSync(exe)) return exe
      }
    }
  }
  return 'mongod' // fall back to PATH
}

mkdirSync(dbPath, { recursive: true })
const mongod = findMongod()
console.log(`[db] ${mongod}\n[db] data: ${dbPath}\n[db] listening on 127.0.0.1:${port}`)

const child = spawn(mongod, ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', port], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
child.on('error', (err) => {
  console.error(`[db] could not start mongod (${err.message}). Set MONGOD_PATH to its location.`)
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
