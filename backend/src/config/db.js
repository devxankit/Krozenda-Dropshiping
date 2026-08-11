import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../lib/logger.js'

mongoose.set('strictQuery', true)

export async function connectDb() {
  if (mongoose.connection.readyState >= 1) {
    return
  }

  mongoose.connection.on('error', (error) => {
    logger.error('[db] connection error', error)
  })
  mongoose.connection.on('disconnected', () => {
    logger.warn('[db] disconnected')
  })

  await mongoose.connect(env.mongoUri)
  logger.info(`[db] connected — ${mongoose.connection.name}`)
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
