import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Encrypts secrets (like Matrix access tokens) before they go in the database,
// so a copy of the database alone doesn't hand them over. The key comes from
// BIRD_SECRET_KEY (base64, 32 bytes) or, if unset, a key file created on first
// use in server/.secrets/ (kept out of git).
const keyFile = resolve(
  process.env.BIRD_SECRET_KEY_FILE ??
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.secrets', 'secret.key'),
)

let key
function getKey() {
  if (key) return key
  if (process.env.BIRD_SECRET_KEY) {
    key = Buffer.from(process.env.BIRD_SECRET_KEY, 'base64')
    if (key.length !== 32) throw new Error('BIRD_SECRET_KEY must be 32 bytes, base64 encoded')
    return key
  }
  if (!existsSync(keyFile)) {
    mkdirSync(dirname(keyFile), { recursive: true })
    writeFileSync(keyFile, randomBytes(32).toString('base64'), { mode: 0o600 })
    try {
      chmodSync(keyFile, 0o600)
    } catch {
      /* not supported on every platform */
    }
  }
  key = Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'base64')
  if (key.length !== 32) throw new Error(`${keyFile} does not hold a 32 byte base64 key`)
  return key
}

// Returns "iv.tag.ciphertext" (base64 parts).
export function encryptSecret(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

export function decryptSecret(packed) {
  const [iv, tag, data] = String(packed).split('.').map((p) => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
