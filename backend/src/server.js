import express from 'express'
import { db } from './database.js'

const app = express()
app.disable('x-powered-by')

app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get()
  res.json({ status: 'ok', database: 'sqlite' })
})

app.get('/api/questions', (req, res) => {
  // Answers stay on the server for future answer validation.
  const questions = db.prepare('SELECT id, text FROM questions ORDER BY id').all()
  res.json(questions)
})

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' })
})

app.use((error, req, res, next) => {
  console.error(error)
  res.status(500).json({ error: 'Server error' })
})

const port = Number(process.env.PORT || 3000)
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Brainring API: http://localhost:${port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)