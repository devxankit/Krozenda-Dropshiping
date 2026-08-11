import { env } from '../src/config/env.js'
import { connectDb } from '../src/config/db.js'
import { app } from '../src/app.js'

export default async function handler(req, res) {
  await connectDb()
  return app(req, res)
}
