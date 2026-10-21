// Puts the Bird icon and name on the Electron program Bird runs inside, so Windows
// shows the bird (not the Electron atom) in the taskbar, Start, Task Manager, alt-tab
// and notifications. Safe to run any time: it only touches electron.exe when the
// icon changed (or after Electron is reinstalled), and never stops the app on failure.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const icon = join(root, 'build', 'icon.ico')

export async function brandElectron(log = console.log) {
  if (process.platform !== 'win32') return false
  try {
    const exe = createRequire(import.meta.url)('electron') // path to electron.exe
    if (!existsSync(exe) || !existsSync(icon)) return false

    // Remember which icon was applied to which exe file, so this is a no-op next time.
    const { size, mtimeMs } = statSync(exe)
    const stamp = createHash('sha1')
      .update(readFileSync(icon))
      .update(`${size}:${mtimeMs}`)
      .digest('hex')
    const marker = join(dirname(exe), '.bird-branded')
    if (existsSync(marker) && readFileSync(marker, 'utf8') === stamp) return false

    const { rcedit } = await import('rcedit')
    await rcedit(exe, {
      icon,
      'version-string': {
        ProductName: 'Bird',
        FileDescription: 'Bird',
        InternalFilename: 'Bird',
        OriginalFilename: 'Bird.exe',
      },
    })
    // The file changed, so record the stamp of the new file.
    const after = statSync(exe)
    const next = createHash('sha1')
      .update(readFileSync(icon))
      .update(`${after.size}:${after.mtimeMs}`)
      .digest('hex')
    writeFileSync(marker, next)
    log('gave the app the Bird icon')
    return true
  } catch (err) {
    log(`could not set the Bird icon on the app (${err.message}); is Bird already running?`)
    return false
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await brandElectron()
}
