import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'brainring-api-'))
process.env.DATABASE_PATH = join(directory, 'test.sqlite')
const { app } = await import('../src/app.js')
const { db } = await import('../src/database.js')
let server, base, cookie, otherCookie, adminCookie, alarmId, challengeId
async function request(
  path,
  { method = 'GET', body, session = cookie, origin } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { cookie: session } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    headers: response.headers,
  }
}
before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
})
after(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  db.close()
  rmSync(directory, { recursive: true, force: true })
})
test('private data needs authentication and cross-origin writes are rejected', async () => {
  assert.equal((await request('/alarms', { session: null })).status, 401)
  assert.equal(
    (
      await request('/auth/register', {
        method: 'POST',
        origin: 'https://other.example',
        body: {},
      })
    ).status,
    403,
  )
})
test('registration validates input, hashes passwords, and creates prototype alarms', async () => {
  assert.equal(
    (
      await request('/auth/register', {
        method: 'POST',
        body: { email: 'invalid', password: 'password123' },
      })
    ).status,
    400,
  )
  const result = await request('/auth/register', {
    method: 'POST',
    body: {
      email: 'first@example.com',
      password: 'password123',
      remember: true,
    },
  })
  assert.equal(result.status, 201)
  cookie = result.cookie
  assert.ok(result.headers.get('set-cookie').includes('HttpOnly'))
  assert.ok(result.headers.get('set-cookie').includes('SameSite=Strict'))
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get('first@example.com')
  assert.notEqual(user.password_hash, 'password123')
  assert.equal(user.password_hash.length, 128)
  const alarms = await request('/alarms')
  assert.equal(alarms.body.length, 2)
  assert.deepEqual(alarms.body[0].days, [1, 2, 3, 4, 5])
  assert.equal(alarms.body[0].enabled, true)
  assert.equal(alarms.body[1].enabled, false)
  assert.equal(
    (
      await request('/auth/register', {
        method: 'POST',
        body: { email: 'FIRST@example.com', password: 'password123' },
      })
    ).status,
    409,
  )
})
test('admin account can sign in and use protected admin users API', async () => {
  assert.equal((await request('/admin/users', { session: null })).status, 401)
  assert.equal((await request('/admin/users')).status, 403)
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'test@admin.lv', password: 'admin123123' },
  })
  assert.equal(adminLogin.status, 200)
  assert.equal(adminLogin.body.user.isAdmin, true)
  adminCookie = adminLogin.cookie
  const users = await request('/admin/users', { session: adminCookie })
  assert.equal(users.status, 200)
  assert.equal(users.body.some((user) => user.email === 'first@example.com'), true)
  const removable = await request('/auth/register', {
    method: 'POST',
    body: { email: 'delete-me@example.com', password: 'password123' },
  })
  assert.equal(removable.status, 201)
  const beforeDelete = await request('/admin/users', { session: adminCookie })
  const removeTarget = beforeDelete.body.find(
    (user) => user.email === 'delete-me@example.com',
  )
  assert.ok(removeTarget)
  assert.equal(
    (await request(`/admin/users/${removeTarget.id}`, { method: 'DELETE', session: adminCookie })).status,
    204,
  )
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'delete-me@example.com', password: 'password123' },
      })
    ).status,
    401,
  )
})
test('alarm CRUD validates and persists SQL data', async () => {
  const body = {
    time: '09:12',
    days: [0, 6],
    mode: 'easy',
    label: "a ' quoted name",
    enabled: true,
  }
  const created = await request('/alarms', { method: 'POST', body })
  assert.equal(created.status, 201)
  alarmId = created.body.id
  assert.equal(
    db.prepare('SELECT label FROM alarms WHERE id = ?').get(alarmId).label,
    body.label,
  )
  assert.equal(
    (
      await request('/alarms', {
        method: 'POST',
        body: { ...body, time: '25:99' },
      })
    ).status,
    400,
  )
  assert.equal(
    (await request('/alarms', { method: 'POST', body: { ...body, days: [8] } }))
      .status,
    400,
  )
  const updated = await request(`/alarms/${alarmId}`, {
    method: 'PUT',
    body: { ...body, enabled: false, time: '10:15' },
  })
  assert.equal(updated.body.enabled, false)
  assert.equal(updated.body.time, '10:15')
})
test('users cannot read, edit, delete, or trigger someone else’s alarms', async () => {
  const result = await request('/auth/register', {
    method: 'POST',
    body: { email: 'second@example.com', password: 'password123' },
  })
  otherCookie = result.cookie
  const saved = await request('/alarms', { session: otherCookie })
  assert.equal(
    saved.body.some((alarm) => alarm.id === alarmId),
    false,
  )
  assert.equal(
    (
      await request(`/alarms/${alarmId}`, {
        method: 'PUT',
        session: otherCookie,
        body: { time: '10:00', days: [], mode: 'easy', enabled: true },
      })
    ).status,
    404,
  )
  assert.equal(
    (
      await request(`/alarms/${alarmId}`, {
        method: 'DELETE',
        session: otherCookie,
      })
    ).status,
    404,
  )
  assert.equal(
    (
      await request('/challenges', {
        method: 'POST',
        session: otherCookie,
        body: { alarmId },
      })
    ).status,
    404,
  )
})
test('challenge hides the answer, persists across reload, and only stops on correct answer', async () => {
  const created = await request('/challenges', {
    method: 'POST',
    body: { mode: 'hard' },
  })
  assert.equal(created.status, 201)
  challengeId = created.body.id
  assert.equal(created.body.prompt, 'who dis?!')
  assert.equal(created.body.options.length, 3)
  assert.equal('answer' in created.body, false)
  assert.equal((await request('/challenges/active')).body.id, challengeId)
  assert.equal(
    (await request('/challenges', { method: 'POST', body: { mode: 'hard' } }))
      .body.id,
    challengeId,
  )
  assert.equal(
    (
      await request(`/challenges/${challengeId}/answer`, {
        method: 'POST',
        session: otherCookie,
        body: { answer: 2 },
      })
    ).status,
    404,
  )
  assert.equal(
    (
      await request(`/challenges/${challengeId}/answer`, {
        method: 'POST',
        body: { answer: 0 },
      })
    ).body.correct,
    false,
  )
  assert.equal((await request('/challenges/active')).body.id, challengeId)
  assert.equal(
    (
      await request(`/challenges/${challengeId}/answer`, {
        method: 'POST',
        body: { answer: 2 },
      })
    ).body.correct,
    true,
  )
  assert.equal((await request('/challenges/active')).body, null)
})
test('single-use alarms turn off when triggered and math modes work', async () => {
  const created = await request('/alarms', {
    method: 'POST',
    body: { time: '10:00', days: [], mode: 'easy', enabled: true },
  })
  const started = await request('/challenges', {
    method: 'POST',
    body: { alarmId: created.body.id },
  })
  assert.equal(started.body.expression, '7 + 8 = ?')
  assert.equal(
    (await request('/alarms')).body.find(
      (alarm) => alarm.id === created.body.id,
    ).enabled,
    false,
  )
  assert.equal(
    (
      await request(`/challenges/${started.body.id}/answer`, {
        method: 'POST',
        body: { answer: 1 },
      })
    ).body.correct,
    true,
  )
  const medium = await request('/challenges', {
    method: 'POST',
    body: { mode: 'medium' },
  })
  assert.equal(medium.body.expression, '6 × 7 = ?')
  assert.equal(
    (
      await request(`/challenges/${medium.body.id}/answer`, {
        method: 'POST',
        body: { answer: 1 },
      })
    ).body.correct,
    true,
  )
})
test('logout revokes session; sign-in verifies the password; delete persists', async () => {
  assert.equal(
    (await request(`/alarms/${alarmId}`, { method: 'DELETE' })).status,
    204,
  )
  assert.equal(
    db.prepare('SELECT id FROM alarms WHERE id = ?').get(alarmId),
    undefined,
  )
  assert.equal((await request('/auth/logout', { method: 'POST' })).status, 204)
  assert.equal((await request('/auth/me')).status, 401)
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'first@example.com', password: 'wrong' },
      })
    ).status,
    401,
  )
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: 'first@example.com', password: 'password123' },
  })
  assert.equal(login.status, 200)
  cookie = login.cookie
  assert.equal((await request('/auth/me')).body.user.email, 'first@example.com')
})
