import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const adminPort = 6320
const userPort = 6321
const username = 'settings-test-user'
const password = 'SettingsPass!123'
const settingsPath = join(process.cwd(), 'data', 'settings.yml')

let adminServer
let userServer
let originalSettingsContent = null
let hadSettingsFile = false

const createScryptHash = (plain) => {
  const N = 16384
  const r = 8
  const p = 1
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const waitForServer = async (baseUrl) => {
  const start = Date.now()
  while (Date.now() - start < 90000) {
    try {
      const res = await fetch(`${baseUrl}/api/mobile/auth/login`, { method: 'POST' })
      if (res.status > 0) return
    } catch {
      // retry
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for server ${baseUrl}`)
}

const startServer = async (port, role) => {
  const proc = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_BYPASS: 'false',
        JWT_SECRET: 'local-test-jwt-secret-abcdefghijklmnopqrstuvwxyz',
        MOBILE_AUTH_USERNAME: username,
        MOBILE_AUTH_PASSWORD_HASH: createScryptHash(password),
        MOBILE_AUTH_ROLE: role,
        MOBILE_JWT_TTL_SECONDS: '600'
      },
      stdio: 'ignore',
      detached: true
    }
  )

  await waitForServer(`http://127.0.0.1:${port}`)
  return proc
}

const stopServer = async (proc) => {
  if (!proc || proc.killed) return
  try {
    process.kill(-proc.pid, 'SIGINT')
  } catch {}
  await delay(800)
  try {
    process.kill(-proc.pid, 'SIGKILL')
  } catch {}
}

const request = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    // keep raw text
  }
  return { response, body }
}

const loginAndGetToken = async (baseUrl) => {
  const { response, body } = await request(baseUrl, '/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(typeof body.token, 'string')
  return body.token
}

before(async () => {
  try {
    originalSettingsContent = await readFile(settingsPath, 'utf-8')
    hadSettingsFile = true
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
    hadSettingsFile = false
  }

  adminServer = await startServer(adminPort, 'admin')
  userServer = await startServer(userPort, 'user')
})

after(async () => {
  await stopServer(adminServer)
  await stopServer(userServer)

  if (hadSettingsFile) {
    await writeFile(settingsPath, originalSettingsContent, 'utf-8')
  } else {
    try {
      await unlink(settingsPath)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
})

test('unauthenticated request to /api/settings/public gets 401', async () => {
  const { response } = await request(`http://127.0.0.1:${adminPort}`, '/api/settings/public')
  assert.equal(response.status, 401)
})

test('user token is forbidden on /api/settings/public', async () => {
  const baseUrl = `http://127.0.0.1:${userPort}`
  const token = await loginAndGetToken(baseUrl)
  const { response } = await request(baseUrl, '/api/settings/public', {
    headers: { authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 403)
})

test('admin GET /api/settings/public returns safe fields only', async () => {
  const baseUrl = `http://127.0.0.1:${adminPort}`
  const token = await loginAndGetToken(baseUrl)
  const { response, body } = await request(baseUrl, '/api/settings/public', {
    headers: { authorization: `Bearer ${token}` }
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(typeof body.settings, 'object')
  assert.equal(body.settings.homeMode !== undefined, true)
  assert.equal(body.settings.sideTripEnabled !== undefined, true)

  const forbidden = [
    'traccarUser',
    'traccarPassword',
    'wordpressUser',
    'wordpressAppPassword',
    'vueTraccarPassword',
    'settingsPassword',
    'traccarUrl',
    'wordpressUrl'
  ]

  for (const key of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(body.settings, key), false)
  }
})

test('POST /api/settings/public rejects secret/internal fields', async () => {
  const baseUrl = `http://127.0.0.1:${adminPort}`
  const token = await loginAndGetToken(baseUrl)
  const { response, body } = await request(baseUrl, '/api/settings/public', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      homeMode: true,
      traccarPassword: 'do-not-accept'
    })
  })

  assert.equal(response.status, 400)
  assert.equal(typeof body, 'object')
})
