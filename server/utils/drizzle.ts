import { drizzle } from 'drizzle-orm/node-postgres'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'
import * as schema from '../db/schema'

const globalForDrizzle = globalThis as unknown as {
  db?: ReturnType<typeof drizzle<typeof schema>>
  pool?: pg.Pool
}

function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../')
  const envFilePath = resolve(projectRoot, '.env')

  try {
    const envFileContent = readFileSync(envFilePath, 'utf8')
    const match = envFileContent.match(/^DATABASE_URL\s*=\s*(.+)$/m)
    const rawValue = match?.[1]?.trim()
    if (!rawValue) {
      return undefined
    }

    const unwrappedValue = rawValue.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    process.env.DATABASE_URL = unwrappedValue
    return unwrappedValue
  } catch {
    return undefined
  }
}

const connectionString = loadDatabaseUrlFromEnvFile()

if (!connectionString) {
  throw new Error('DATABASE_URL 未配置')
}

const pool = globalForDrizzle.pool ?? new pg.Pool({ connectionString })
export const db = globalForDrizzle.db ?? drizzle(pool, { schema })

if (process.env.NODE_ENV !== 'production') {
  globalForDrizzle.db = db
  globalForDrizzle.pool = pool
}
