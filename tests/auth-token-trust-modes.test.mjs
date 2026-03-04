import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const strictPort = 6210
const legacyPort = 6211
const trustedForwardHeaderName = 'x-forwarded-proxy-auth'
const trustedForwardHeaderValue = 'authelia-forwardauth'

const runningProcesses = []

const waitForServer = async (baseUrl) => {
  const start = Date.now()
  while (Date.now() - start < 90000) {
    try {
      const res = await fetch(`${baseUrl}/api/auth/me`)
      if (res.status > 0) return
    } catch {
      // retry
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for server ${baseUrl}`)
}

const startServer = async (port, enforceTrustedMarker) => {
  const proc = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_BYPASS: 'false',
        JWT_SECRET: 'local-test-jwt-secret-abcdefghijklmnopqrstuvwxyz',
        FORWARD_AUTH_ENFORCE_TRUSTED_MARKER: enforceTrustedMarker ? 'true' : 'false',
        FORWARD_AUTH_TRUSTED_HEADER_NAME: trustedForwardHeaderName,
        FORWARD_AUTH_TRUSTED_HEADER_VALUE: trustedForwardHeaderValue
      },
      stdio: 'ignore',
      detached: true
    }
  )
  runningProcesses.push(proc)
  const baseUrl = `http://127.0.0.1:${port}`
  await waitForServer(baseUrl)
  return baseUrl
}

const request = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { response, body }
}

after(async () => {
  for (const proc of runningProcesses) {
    if (!proc || proc.killed) continue
    try {
      // Kill the full process group so npm/sh/nuxt children are terminated too.
      process.kill(-proc.pid, 'SIGINT')
    } catch {
      // Ignore: process may already be gone.
    }
  }
  await delay(800)
  for (const proc of runningProcesses) {
    if (!proc || proc.killed) continue
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {
      // Ignore: process may already be gone.
    }
  }
})

test('strict mode: valid trusted forward-auth request -> 200 token issued', async () => {
  const baseUrl = await startServer(strictPort, true)
  const { response, body } = await request(baseUrl, '/api/auth/token', {
    method: 'POST',
    headers: {
      [trustedForwardHeaderName]: trustedForwardHeaderValue,
      'x-remote-user': 'alice',
      'x-remote-groups': 'admins,users'
    }
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.user, 'alice')
})

test('strict mode: spoofed forwarded headers from untrusted context -> 401', async () => {
  const baseUrl = `http://127.0.0.1:${strictPort}`
  const { response, body } = await request(baseUrl, '/api/auth/token', {
    method: 'POST',
    headers: {
      'x-remote-user': 'alice',
      'x-remote-groups': 'admins'
    }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('strict mode: malformed header values -> 401', async () => {
  const baseUrl = `http://127.0.0.1:${strictPort}`
  const { response, body } = await request(baseUrl, '/api/auth/token', {
    method: 'POST',
    headers: {
      [trustedForwardHeaderName]: trustedForwardHeaderValue,
      'x-remote-user': 'bad user'
    }
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('legacy mode: missing remote-user header -> 401', async () => {
  const baseUrl = await startServer(legacyPort, false)
  const { response, body } = await request(baseUrl, '/api/auth/token', {
    method: 'POST'
  })

  assert.equal(response.status, 401)
  assert.deepEqual(body, { error: 'unauthorized' })
})

test('legacy mode: valid forwarded identity without trusted marker -> 200', async () => {
  const baseUrl = `http://127.0.0.1:${legacyPort}`
  const { response, body } = await request(baseUrl, '/api/auth/token', {
    method: 'POST',
    headers: {
      'x-remote-user': 'legacy-user',
      'x-remote-groups': 'users'
    }
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.user, 'legacy-user')
})
