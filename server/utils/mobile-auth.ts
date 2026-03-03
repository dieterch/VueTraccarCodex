import { scryptSync, timingSafeEqual } from 'node:crypto'

type LoginAttempt = {
  failures: number
  windowStart: number
  blockedUntil: number
}

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const BLOCK_MS = 60 * 1000
const DEFAULT_MOBILE_TTL_SECONDS = 600
const MIN_MOBILE_TTL_SECONDS = 300
const MAX_MOBILE_TTL_SECONDS = 900

const weakSecrets = new Set(['', 'change-me', 'changeme', 'secret', 'jwtsecret', 'default'])
const loginAttempts = new Map<string, LoginAttempt>()

export const isWeakJwtSecret = (secret: string) => {
  const normalized = String(secret || '').trim().toLowerCase()
  if (weakSecrets.has(normalized)) return true
  return normalized.length < 32
}

export const normalizeMobileTtlSeconds = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MOBILE_TTL_SECONDS
  }
  const clamped = Math.floor(parsed)
  return Math.min(MAX_MOBILE_TTL_SECONDS, Math.max(MIN_MOBILE_TTL_SECONDS, clamped))
}

export const parseBearerToken = (headerValue: unknown) => {
  const raw = String(headerValue || '')
  if (!raw.toLowerCase().startsWith('bearer ')) {
    return ''
  }
  return raw.slice(7).trim()
}

export const secureStringEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8')
  const rightBuffer = Buffer.from(String(right || ''), 'utf8')
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const verifyScryptPassword = (password: string, encodedHash: string) => {
  const parts = String(encodedHash || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false
  }

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'base64')
  const expectedHash = Buffer.from(parts[5], 'base64')

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false
  }
  if (salt.length === 0 || expectedHash.length === 0) {
    return false
  }

  try {
    const derived = scryptSync(password, salt, expectedHash.length, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 2
    })
    return timingSafeEqual(derived, expectedHash)
  } catch {
    return false
  }
}

export const consumeLoginRateLimit = (key: string, now = Date.now()) => {
  const state = loginAttempts.get(key)
  if (!state) {
    return { allowed: true, retryAfterMs: 0 }
  }

  if (state.blockedUntil > now) {
    return { allowed: false, retryAfterMs: state.blockedUntil - now }
  }

  if (now - state.windowStart > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key)
    return { allowed: true, retryAfterMs: 0 }
  }

  return { allowed: true, retryAfterMs: 0 }
}

export const registerFailedLogin = (key: string, now = Date.now()) => {
  const current = loginAttempts.get(key)
  if (!current || now - current.windowStart > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, {
      failures: 1,
      windowStart: now,
      blockedUntil: 0
    })
    return
  }

  const failures = current.failures + 1
  current.failures = failures
  if (failures >= MAX_ATTEMPTS) {
    current.blockedUntil = now + BLOCK_MS
  }
}

export const clearLoginRateLimit = (key: string) => {
  loginAttempts.delete(key)
}
