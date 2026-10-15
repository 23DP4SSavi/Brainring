import express from 'express'
import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { db } from './database.js'

export const app = express()
const deriveKey = promisify(scrypt)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const sessionAge = 30 * 24 * 60 * 60
const attempts = new Map()
app.disable('x-powered-by')
app.use(express.json({ limit: '10kb' }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    req.headers.origin
  ) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return res.status(403).json({ error: 'Request origin is not allowed.' })
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' })
    }
  }
  next()
})
function cookieToken(req) {
  return (req.headers.cookie || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('brainring_session='))
    ?.slice('brainring_session='.length)
}
app.use('/api', (req, res, next) => {
  const token = cookieToken(req)
  if (token)
    req.user = db
      .prepare(
        'SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?',
      )
      .get(hash(token), Date.now())
  next()
})
function authenticated(req, res, next) {
  if (!req.user)
    return res.status(401).json({ error: 'Please sign in to continue.' })
  next()
}
function limitAuth(req, res, next) {
  const now = Date.now()
  for (const [key, record] of attempts)
    if (record.until < now) attempts.delete(key)
  const key = req.ip
  const record = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 }
  if (record.count >= 30)
    return res
      .status(429)
      .json({ error: 'Too many attempts. Try again in 15 minutes.' })
  record.count++
  attempts.set(key, record)
  next()
}
function createSession(req, res, user, remember) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  const token = randomBytes(32).toString('hex')
  const age = remember ? sessionAge : 24 * 60 * 60
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
    hash(token),
    user.id,
    Date.now() + age * 1000,
  )
  res.cookie('brainring_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    path: '/',
    ...(remember ? { maxAge: age * 1000 } : {}),
  })
}
function credentials(body) {
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  return { email, password }
}
app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get()
  res.json({ status: 'ok', database: 'sqlite' })
})
app.post('/api/auth/register', limitAuth, async (req, res) => {
  const { email, password } = credentials(req.body || {})
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return res.status(400).json({ error: 'Enter a valid email address.' })
  if (password.length < 8 || password.length > 128)
    return res
      .status(400)
      .json({ error: 'Use a password between 8 and 128 characters.' })
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    return res
      .status(409)
      .json({ error: 'An account with this email already exists.' })
  const salt = randomBytes(16).toString('hex')
  const key = await deriveKey(password, salt, 64)
  let id
  try {
    db.exec('BEGIN')
    id = Number(
      db
        .prepare(
          'INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)',
        )
        .run(email, key.toString('hex'), salt).lastInsertRowid,
    )
    const add = db.prepare(
      'INSERT INTO alarms (user_id, time, days, mode, enabled) VALUES (?, ?, ?, ?, ?)',
    )
    add.run(id, '06:30', '[1,2,3,4,5]', 'hard', 1)
    add.run(id, '08:15', '[6]', 'medium', 0)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
      return res
        .status(409)
        .json({ error: 'An account with this email already exists.' })
    throw error
  }
  const user = { id, email }
  createSession(req, res, user, req.body.remember === true)
  res.status(201).json({ user })
})
app.post('/api/auth/login', limitAuth, async (req, res) => {
  const { email, password } = credentials(req.body || {})
  if (!email || !password || password.length > 128)
    return res.status(400).json({ error: 'Enter your email and password.' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  const key = await deriveKey(
    password,
    user?.salt || 'brainring-dummy-salt',
    64,
  )
  if (!user || !timingSafeEqual(key, Buffer.from(user.password_hash, 'hex')))
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  createSession(req, res, user, req.body.remember === true)
  res.json({ user: { id: user.id, email: user.email } })
})
app.post('/api/auth/logout', (req, res) => {
  const token = cookieToken(req)
  if (token)
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
  res.clearCookie('brainring_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
  })
  res.status(204).end()
})
app.get('/api/auth/me', authenticated, (req, res) =>
  res.json({ user: req.user }),
)
const serializeAlarm = (alarm) => ({
  ...alarm,
  days: JSON.parse(alarm.days),
  enabled: Boolean(alarm.enabled),
  user_id: undefined,
})
function alarmInput(body) {
  const { time, days, mode, label = '', enabled = true } = body || {}
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return null
  if (
    !Array.isArray(days) ||
    days.length > 7 ||
    days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    return null
  if (
    !['easy', 'medium', 'hard'].includes(mode) ||
    typeof label !== 'string' ||
    label.length > 60 ||
    typeof enabled !== 'boolean'
  )
    return null
  return {
    time,
    days: JSON.stringify([...new Set(days)].sort()),
    mode,
    label: label.trim(),
    enabled: Number(enabled),
  }
}
app.get('/api/alarms', authenticated, (req, res) => {
  res.json(
    db
      .prepare('SELECT * FROM alarms WHERE user_id = ? ORDER BY time, id')
      .all(req.user.id)
      .map(serializeAlarm),
  )
})
app.post('/api/alarms', authenticated, (req, res) => {
  const alarm = alarmInput(req.body)
  if (!alarm)
    return res
      .status(400)
      .json({ error: 'Check the time, repeat days, and difficulty.' })
  if (
    db
      .prepare('SELECT count(*) AS count FROM alarms WHERE user_id = ?')
      .get(req.user.id).count >= 50
  )
    return res.status(400).json({ error: 'You can save up to 50 alarms.' })
  const id = Number(
    db
      .prepare(
        'INSERT INTO alarms (user_id, time, days, mode, label, enabled) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        req.user.id,
        alarm.time,
        alarm.days,
        alarm.mode,
        alarm.label,
        alarm.enabled,
      ).lastInsertRowid,
  )
  res
    .status(201)
    .json(
      serializeAlarm(db.prepare('SELECT * FROM alarms WHERE id = ?').get(id)),
    )
})
app.put('/api/alarms/:id', authenticated, (req, res) => {
  const alarm = alarmInput(req.body)
  if (!alarm)
    return res
      .status(400)
      .json({ error: 'Check the time, repeat days, and difficulty.' })
  const result = db
    .prepare(
      'UPDATE alarms SET time = ?, days = ?, mode = ?, label = ?, enabled = ? WHERE id = ? AND user_id = ?',
    )
    .run(
      alarm.time,
      alarm.days,
      alarm.mode,
      alarm.label,
      alarm.enabled,
      req.params.id,
      req.user.id,
    )
  if (!result.changes)
    return res.status(404).json({ error: 'Alarm not found.' })
  res.json(
    serializeAlarm(
      db.prepare('SELECT * FROM alarms WHERE id = ?').get(req.params.id),
    ),
  )
})
app.delete('/api/alarms/:id', authenticated, (req, res) => {
  const result = db
    .prepare('DELETE FROM alarms WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id)
  if (!result.changes)
    return res.status(404).json({ error: 'Alarm not found.' })
  res.status(204).end()
})
function challengeView(challenge) {
  const question = db
    .prepare('SELECT prompt, image, options FROM quiz_questions WHERE id = ?')
    .get(challenge.question_id)
  return {
    id: challenge.id,
    time: challenge.time,
    mode: challenge.mode,
    prompt: question.prompt,
    image: question.image,
    expression:
      challenge.mode === 'easy'
        ? '7 + 8 = ?'
        : challenge.mode === 'medium'
          ? '6 × 7 = ?'
          : null,
    options: JSON.parse(question.options),
  }
}
app.get('/api/challenges/active', authenticated, (req, res) => {
  const challenge = db
    .prepare(
      'SELECT * FROM challenges WHERE user_id = ? AND solved = 0 ORDER BY created_at DESC LIMIT 1',
    )
    .get(req.user.id)
  res.json(challenge ? challengeView(challenge) : null)
})
app.post('/api/challenges', authenticated, (req, res) => {
  const active = db
    .prepare(
      'SELECT * FROM challenges WHERE user_id = ? AND solved = 0 LIMIT 1',
    )
    .get(req.user.id)
  if (active) return res.json(challengeView(active))
  let time, mode
  if (req.body?.alarmId !== undefined) {
    const alarm = db
      .prepare(
        'SELECT * FROM alarms WHERE id = ? AND user_id = ? AND enabled = 1',
      )
      .get(req.body.alarmId, req.user.id)
    if (!alarm)
      return res.status(404).json({ error: 'Active alarm not found.' })
    time = alarm.time
    mode = alarm.mode
    if (JSON.parse(alarm.days).length === 0)
      db.prepare('UPDATE alarms SET enabled = 0 WHERE id = ?').run(alarm.id)
  } else {
    mode = req.body?.mode || 'hard'
    if (!['easy', 'medium', 'hard'].includes(mode))
      return res.status(400).json({ error: 'Invalid difficulty.' })
    const now = new Date()
    time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }
  const question = db
    .prepare('SELECT id FROM quiz_questions WHERE mode = ?')
    .get(mode)
  const challenge = {
    id: randomBytes(16).toString('hex'),
    question_id: question.id,
    time,
    mode,
  }
  db.prepare(
    'INSERT INTO challenges (id, user_id, question_id, time, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(challenge.id, req.user.id, question.id, time, mode, Date.now())
  res.status(201).json(challengeView(challenge))
})
app.post('/api/challenges/:id/answer', authenticated, (req, res) => {
  const challenge = db
    .prepare(
      'SELECT * FROM challenges WHERE id = ? AND user_id = ? AND solved = 0',
    )
    .get(req.params.id, req.user.id)
  if (!challenge)
    return res.status(404).json({ error: 'Active challenge not found.' })
  const { answer } = req.body || {}
  const question = db
    .prepare('SELECT answer, options FROM quiz_questions WHERE id = ?')
    .get(challenge.question_id)
  if (
    !Number.isInteger(answer) ||
    answer < 0 ||
    answer >= JSON.parse(question.options).length
  )
    return res.status(400).json({ error: 'Choose one of the answers.' })
  const correct = question.answer === answer
  if (correct)
    db.prepare('UPDATE challenges SET solved = 1 WHERE id = ?').run(
      challenge.id,
    )
  res.json({ correct })
})
app.get('/api/questions', authenticated, (req, res) =>
  res.json(db.prepare('SELECT id, text FROM questions ORDER BY id').all()),
)
app.use('/api', (req, res) =>
  res.status(404).json({ error: 'API endpoint not found.' }),
)
const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
if (existsSync(frontend)) {
  app.use(express.static(frontend))
  app.get('/{*path}', (req, res) => res.sendFile(`${frontend}/index.html`))
}
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400)
    return res.status(400).json({ error: 'Invalid JSON.' })
  console.error(error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})
