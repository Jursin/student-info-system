import { sql } from 'drizzle-orm'
import { db } from '../utils/drizzle'

async function main() {
  await db.execute(sql`
    TRUNCATE TABLE
      session_tokens,
      dynamic_field_values,
      dynamic_table_rows,
      dynamic_fields,
      dynamic_tables,
      student_profiles,
      operation_logs,
      user_accounts
    RESTART IDENTITY CASCADE
  `)

  console.log('Drizzle clear completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
