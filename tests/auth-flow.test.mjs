import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const port = 6110
const baseUrl = `http://127.0.0.1:${port}`
const username = 'mobile-test-user'
const password = 'MobilePass!123'
const trustedForwardHeaderName = 'x-forwarded-proxy-auth'
const trustedForwardHeaderValue = 'authelia-forwardauth'

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
      const res = await fetch(`${baseUrl}/api/mobile/auth/login`, { method: 'POST' })
      if (res.status > 0) {
        return
      }
    } catch {
      // retry until server is up
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

before(async () => {
  const mobileHash = createScryptHash(password)
  serverProcess = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_BYPASS: 'false',
        JWT_SECRET: 'local-test-jwt-secret-abcdefghijklmnopqrstuvwxyz',
        MOBILE_AUTH_USERNAME: username,
        MOBILE_AUTH_PASSWORD_HASH: mobileHash,
        MOBILE_AUTH_ROLE: 'user',
        MOBILE_JWT_TTL_SECONDS: '600',
        FORWARD_AUTH_TRUSTED_HEADER_NAME: trustedForwardHeaderName,
        FORWARD_AUTH_TRUSTED_HEADER_VALUE: trustedForwardHeaderValue
      },
      stdio: 'ignore'
    }
  )

  await waitForServer()
})

after(async () => {
  if (!serverProcess || serverProcess.killed) return
  serverProcess.kill('SIGINT')
  await delay(500)
})

test('mobile login succeeds with valid credentials', async () => {
  const { response, body } = await request('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(typeof body.token, 'string')
  assert.equal(body.user, username)
})

test('mobile login fails with invalid credentials', async () => {
  const { response, body } = await request('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'wrong-password' })
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('valid bearer reaches protected /api handler', async () => {
  const login = await request('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const token = login.body.token
  assert.equal(typeof token, 'string')

  const { response, body } = await request('/api/cache-status', {
    headers: { authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
})

test('invalid bearer returns 401 JSON', async () => {
  const { response, body } = await request('/api/cache-status', {
    headers: { authorization: 'Bearer invalid' }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('missing bearer keeps existing fallback behavior', async () => {
  const { response, body } = await request('/api/cache-status')
  assert.equal(response.status, 401)
  assert.equal(body.message, 'Missing auth token')
})

test('valid bearer reaches protected /api/mobile handler', async () => {
  const login = await request('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const token = login.body.token
  assert.equal(typeof token, 'string')

  const { response, body } = await request('/api/mobile/ping', {
    headers: { authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.user, username)
})

test('missing bearer on /api/mobile returns 401 JSON', async () => {
  const { response, body } = await request('/api/mobile/ping')
  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('invalid bearer on /api/mobile returns 401 JSON', async () => {
  const { response, body } = await request('/api/mobile/ping', {
    headers: { authorization: 'Bearer invalid' }
  })
  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('valid cookie without bearer on /api/mobile returns 401 JSON', async () => {
  const login = await request('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const token = login.body.token
  assert.equal(typeof token, 'string')

  const { response, body } = await request('/api/mobile/ping', {
    headers: { cookie: `vt_auth=${token}` }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('valid trusted forward-auth request issues token', async () => {
  const { response, body } = await request('/api/auth/token', {
    method: 'POST',
    headers: {
      [trustedForwardHeaderName]: trustedForwardHeaderValue,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'dtraccarcodex.home.smallfamilybusiness.net',
      'x-remote-user': 'alice',
      'x-remote-groups': 'admins,users'
    }
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.user, 'alice')
  assert.equal(typeof body.exp, 'number')
})

test('missing remote-user header returns 401', async () => {
  const { response, body } = await request('/api/auth/token', {
    method: 'POST',
    headers: {
      [trustedForwardHeaderName]: trustedForwardHeaderValue,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'dtraccarcodex.home.smallfamilybusiness.net'
    }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('spoofed forwarded identity from untrusted context returns 401', async () => {
  const { response, body } = await request('/api/auth/token', {
    method: 'POST',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'dtraccarcodex.home.smallfamilybusiness.net',
      'x-remote-user': 'alice',
      'x-remote-groups': 'admins'
    }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('malformed forward-auth header values return 401', async () => {
  const { response, body } = await request('/api/auth/token', {
    method: 'POST',
    headers: {
      [trustedForwardHeaderName]: trustedForwardHeaderValue,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'dtraccarcodex.home.smallfamilybusiness.net',
      'x-remote-user': 'bad user'
    }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})
