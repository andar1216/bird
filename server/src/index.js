import { createApp } from './app.js'
import { config } from './config.js'
import { connectDb, disconnectDb } from './db.js'
import { startAllSync, stopAllSync } from './matrix/sync.js'

try {
  await connectDb(config.mongoUri)
} catch (err) {
  console.error(`[server] cannot reach MongoDB at ${config.mongoUri}: ${err.message}`)
  console.error('[server] start it with:  npm run db')
  process.exit(1)
}

const server = createApp().listen(config.port, config.host, () => {
  console.log(`[server] http://${config.host}:${config.port}  (db: ${config.mongoUri})`)
})

await startAllSync() // resume every saved Matrix account

async function shutdown() {
  stopAllSync()
  server.close()
  await disconnectDb()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
