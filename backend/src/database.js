import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'

const dataDirectory = new URL('../data/', import.meta.url)
mkdirSync(dataDirectory, { recursive: true })
export const db = new DatabaseSync(new URL('brainring.sqlite', dataDirectory))
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))