import { HttpError } from '../lib/http.js'
import { hashToken } from '../lib/crypto.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'

// Authenticates `Authorization: Bearer <token>` and sets req.user / req.session.
// Every route behind this must scope its queries by req.user._id.
export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, 'Authentication required')
  }
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
  const user = session && (await User.findById(session.userId))
  if (!user) throw new HttpError(401, 'Authentication required')
  req.user = user
  req.session = session
  next()
}
