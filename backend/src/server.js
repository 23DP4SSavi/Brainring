import { app } from './app.js'
import { db } from './database.js'

const port = Number(process.env.PORT || 3000)
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`BrainRing: http://localhost:${port}`)
})
function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
