import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { config } from './config.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { authRouter } from './routes/auth.js'
import { chatsRouter } from './routes/chats.js'
import { connectionsRouter } from './routes/connections.js'
import { matrixRouter } from './routes/matrix.js'

export function createApp({ corsOrigins = config.corsOrigins } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      // Requests without an Origin (curl, tests, server-to-server) are allowed.
      origin: (origin, cb) => cb(null, !origin || corsOrigins.includes(origin)),
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 })
  })
  app.use('/api/auth', authRouter)
  app.use('/api/connections', connectionsRouter)
  app.use('/api/chats', chatsRouter)
  app.use('/api/matrix', matrixRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
