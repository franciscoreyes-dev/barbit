import fs from 'fs'
import path from 'path'
import { db } from './pool'

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      ran_at   TIMESTAMPTZ DEFAULT now()
    )
  `)

  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    const { rows } = await db.query(
      'SELECT filename FROM _migrations WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) {
      console.log(`skip: ${file}`)
      continue
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await db.query(sql)
    await db.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
    console.log(`ran: ${file}`)
  }

  await db.end()
  console.log('migrations complete')
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
