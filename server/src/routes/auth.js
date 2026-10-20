import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { HttpError, parse } from '../lib/http.js'
import { hashPassword, newToken, verifyPassword } from '../lib/crypto.js'
import { requireAuth } from '../middleware/auth.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'

const email = z.string().trim().toLowerCase().pipe(z.email())
const registerBody = z.object({
  email,
  password: z.string().min(8, 'At least 8 characters').max(200),
  displayName: z.string().trim().min(1).max(60),
})
const loginBody = z.object({ email, password: z.string().min(1).max(200) })

async function startSession(user, req) {
  const { token, tokenHash } = newToken()
  await Session.create({
    userId: user._id,
    tokenHash,
    userAgent: req.get('user-agent')?.slice(0, 300),
    expiresAt: new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000),
  })
  return token
}

export const authRouter = Router()

// Brute-force protection for credential endpoints.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
})

authRouter.post('/register', limiter, async (req, res) => {
  const body = parse(registerBody, req.body)
  const { passwordHash, passwordSalt } = await hashPassword(body.password)
  const user = await User.create({
    email: body.email,
    displayName: body.displayName,
    passwordHash,
    passwordSalt,
  })
  const token = await startSession(user, req)
  res.status(201).json({ token, user: user.toPublic() })
})

authRouter.post('/login', limiter, async (req, res) => {
  const body = parse(loginBody, req.body)
  const user = await User.findOne({ email: body.email }).select('+passwordHash +passwordSalt')
  const ok = await verifyPassword(body.password, user)
  if (!ok) throw new HttpError(401, 'Invalid email or password')
  const token = await startSession(user, req)
  res.json({ token, user: user.toPublic() })
})

authRouter.post('/logout', requireAuth, async (req, res) => {
  await Session.deleteOne({ _id: req.session._id })
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() })
})
