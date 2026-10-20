import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const location =
  process.env.DATABASE_PATH ||
  new URL('../data/brainring.sqlite', import.meta.url)
if (typeof location === 'string' && location !== ':memory:')
  mkdirSync(dirname(location), { recursive: true })
else if (location instanceof URL)
  mkdirSync(new URL('.', location), { recursive: true })
export const db = new DatabaseSync(location)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
try {
  db.exec(
    'ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1))',
  )
} catch (error) {
  if (!String(error.message).includes('duplicate column name')) throw error
}
