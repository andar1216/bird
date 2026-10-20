const num = (value, fallback) =>
  value === undefined || value === '' ? fallback : Number(value)

export const config = {
  // Bind to loopback by default: this server is meant to run next to the app.
  host: process.env.HOST ?? '127.0.0.1',
  port: num(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/bird',
  // "null" is the Origin sent by the packaged Electron app (file://).
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,null')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  sessionDays: num(process.env.SESSION_DAYS, 30),
  authRateLimit: num(process.env.AUTH_RATE_LIMIT, 50), // per 15 min per IP
  // How long the homeserver may hold a /sync request open waiting for news.
  matrixSyncTimeoutMs: num(process.env.MATRIX_SYNC_TIMEOUT_MS, 25_000),
}
