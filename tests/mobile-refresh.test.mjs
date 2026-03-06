import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const port = 6300 + Math.floor(Math.random() * 200)
const baseUrl = `http://127.0.0.1:${port}`
const username = 'mobile-refresh-user'
const password = 'RefreshPass!123'

let serverProcess

const createScryptHash = (plain) => {
  const N = 16384
  const r = 8
  const p = 1
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const waitForServer = async () => {
  const start = Date.now()
  while (Date.now() - start < 90000) {
    try {
      const res = await fetch(`${baseUrl}/api/mobile/ping`)
      if (res.status > 0) return
    } catch {
      // wait until server is up
    }
    await delay(500)
  }
  throw new Error('Timed out waiting for local dev server')
}

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { response, body }
}

const login = async () => {
  const res = await request('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  assert.equal(res.response.status, 200)
  assert.equal(typeof res.body.accessToken, 'string')
  assert.equal(typeof res.body.refreshToken, 'string')
  return res.body
}

before(async () => {
  const mobileHash = createScryptHash(password)
  serverProcess = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      detached: true,
      env: {
        ...process.env,
        AUTH_BYPASS: 'false',
        JWT_SECRET: 'local-test-jwt-secret-abcdefghijklmnopqrstuvwxyz',
        MOBILE_AUTH_USERNAME: username,
        MOBILE_AUTH_PASSWORD_HASH: mobileHash,
        MOBILE_AUTH_ROLE: 'user',
        MOBILE_JWT_TTL_SECONDS: '900',
        MOBILE_REFRESH_TOKEN_TTL_SECONDS: '2592000',
        MOBILE_REFRESH_TOKEN_HASH_SECRET: 'local-refresh-secret-abcdefghijklmnopqrstuvwxyz'
      },
      stdio: 'ignore'
    }
  )

  await waitForServer()
})

after(async () => {
  if (!serverProcess || serverProcess.killed) return
  try {
    process.kill(-serverProcess.pid, 'SIGTERM')
  } catch {
    // ignore if already stopped
  }
  await delay(1000)
  try {
    process.kill(-serverProcess.pid, 'SIGKILL')
  } catch {
    // ignore if already stopped
  }
})

test('login returns access + refresh token pair', async () => {
  const body = await login()
  assert.equal(body.success, true)
  assert.equal(typeof body.exp, 'number')
  assert.equal(typeof body.refreshExp, 'number')
})

test('refresh rotates refresh token and issues new access token', async () => {
  const first = await login()
  const refreshed = await request('/api/mobile/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: first.refreshToken })
  })

  assert.equal(refreshed.response.status, 200)
  assert.equal(refreshed.body.success, true)
  assert.notEqual(refreshed.body.refreshToken, first.refreshToken)
  assert.equal(typeof refreshed.body.accessToken, 'string')
})

test('refresh token reuse revokes token family and returns 401', async () => {
  const first = await login()
  const refresh1 = await request('/api/mobile/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: first.refreshToken })
  })
  assert.equal(refresh1.response.status, 200)

  const reuseOld = await request('/api/mobile/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: first.refreshToken })
  })
  assert.equal(reuseOld.response.status, 401)
  assert.deepEqual(reuseOld.body, { error: 'unauthorized' })

  const usingNewAfterReuse = await request('/api/mobile/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh1.body.refreshToken })
  })
  assert.equal(usingNewAfterReuse.response.status, 401)
  assert.deepEqual(usingNewAfterReuse.body, { error: 'unauthorized' })
})

test('logout revokes refresh token family', async () => {
  const first = await login()
  const logout = await request('/api/mobile/auth/logout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: first.refreshToken })
  })
  assert.equal(logout.response.status, 200)
  assert.equal(logout.body.success, true)

  const refreshAfterLogout = await request('/api/mobile/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: first.refreshToken })
  })
  assert.equal(refreshAfterLogout.response.status, 401)
  assert.deepEqual(refreshAfterLogout.body, { error: 'unauthorized' })
})
