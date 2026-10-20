import { HttpError } from '../lib/http.js'

export const notFound = (_req, res) => res.status(404).json({ error: 'Not found' })

// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument signature
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details })
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'Already exists' })
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' })
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' })
  console.error(err)
  return res.status(500).json({ error: 'Internal server error' })
}
