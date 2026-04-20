import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema'

const globalForDrizzle = globalThis as unknown as {
  db?: ReturnType<typeof drizzle<typeof schema>>
  pool?: pg.Pool
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL 未配置')
}

const pool = globalForDrizzle.pool ?? new pg.Pool({ connectionString })
export const db = globalForDrizzle.db ?? drizzle(pool, { schema })

if (process.env.NODE_ENV !== 'production') {
  globalForDrizzle.db = db
  globalForDrizzle.pool = pool
}
