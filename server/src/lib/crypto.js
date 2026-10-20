import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH)
  return { passwordSalt: salt.toString('base64'), passwordHash: hash.toString('base64') }
}

let dummyRecord
// `record` may be null (unknown email): we still spend the same time hashing so
// response timing does not reveal whether an account exists.
export async function verifyPassword(password, record) {
  dummyRecord ??= await hashPassword('bird-dummy-password')
  const target = record ?? dummyRecord
  const expected = Buffer.from(target.passwordHash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(target.passwordSalt, 'base64'), KEY_LENGTH)
  return timingSafeEqual(expected, actual) && record !== null
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex')

export function newToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}
