import { env } from './config/env.js'
import { connectDb, disconnectDb } from './config/db.js'
import { logger } from './lib/logger.js'
import { app } from './app.js'

async function main() {
  await connectDb()

  const server = app.listen(env.port, () => {
    logger.info(`[server] listening on port ${env.port} (${env.nodeEnv})`)
  })

  const shutdown = async (signal) => {
    logger.info(`[server] received ${signal}, shutting down`)
    server.close(async () => {
      await disconnectDb()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.error('[server] failed to start', error)
  process.exit(1)
})
