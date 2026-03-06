import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

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
const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60
const MIN_REFRESH_TTL_SECONDS = 24 * 60 * 60
const MAX_REFRESH_TTL_SECONDS = 60 * 24 * 60 * 60

type RefreshSession = {
  id: string
  familyId: string
  user: string
  role: 'admin' | 'user'
  groups: string[]
  tokenHash: string
  createdAt: number
  expiresAt: number
  revokedAt: number | null
  replacedBy: string | null
}

const weakSecrets = new Set(['', 'change-me', 'changeme', 'secret', 'jwtsecret', 'default'])
const loginAttempts = new Map<string, LoginAttempt>()
const refreshSessionsById = new Map<string, RefreshSession>()
const refreshSessionIdByHash = new Map<string, string>()
const refreshFamilyIndex = new Map<string, Set<string>>()

const randomId = () => randomBytes(18).toString('base64url')

const normalizeRole = (value: unknown): 'admin' | 'user' => {
  return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user'
}

const hashRefreshToken = (rawToken: string, secret: string) => {
  return createHmac('sha256', String(secret || ''))
    .update(String(rawToken || ''), 'utf8')
    .digest('hex')
}

const cleanupRefreshSessions = (now = Math.floor(Date.now() / 1000)) => {
  for (const [id, session] of refreshSessionsById.entries()) {
    const expired = session.expiresAt <= now
    const longRevoked = session.revokedAt !== null && session.revokedAt + 24 * 60 * 60 <= now
    if (!expired && !longRevoked) {
      continue
    }

    refreshSessionsById.delete(id)
    refreshSessionIdByHash.delete(session.tokenHash)
    const familySet = refreshFamilyIndex.get(session.familyId)
    if (familySet) {
      familySet.delete(id)
      if (familySet.size === 0) {
        refreshFamilyIndex.delete(session.familyId)
      }
    }
  }
}

const revokeFamily = (familyId: string, now = Math.floor(Date.now() / 1000)) => {
  const sessionIds = refreshFamilyIndex.get(familyId)
  if (!sessionIds) return
  for (const sessionId of sessionIds) {
    const session = refreshSessionsById.get(sessionId)
    if (!session) continue
    if (session.revokedAt === null) {
      session.revokedAt = now
    }
  }
}

const createRefreshSession = (
  input: { user: string; role: 'admin' | 'user'; groups: string[]; familyId?: string },
  ttlSeconds: number,
  hashSecret: string,
  now = Math.floor(Date.now() / 1000)
) => {
  const id = randomId()
  const familyId = input.familyId || randomId()
  const rawToken = randomBytes(48).toString('base64url')
  const tokenHash = hashRefreshToken(rawToken, hashSecret)
  const session: RefreshSession = {
    id,
    familyId,
    user: input.user,
    role: normalizeRole(input.role),
    groups: Array.isArray(input.groups) ? input.groups.map(String) : [],
    tokenHash,
    createdAt: now,
    expiresAt: now + ttlSeconds,
    revokedAt: null,
    replacedBy: null
  }

  refreshSessionsById.set(id, session)
  refreshSessionIdByHash.set(tokenHash, id)
  const familySet = refreshFamilyIndex.get(familyId) || new Set<string>()
  familySet.add(id)
  refreshFamilyIndex.set(familyId, familySet)

  return {
    refreshToken: rawToken,
    exp: session.expiresAt,
    session
  }
}

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

export const normalizeRefreshTtlSeconds = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REFRESH_TTL_SECONDS
  }
  const clamped = Math.floor(parsed)
  return Math.min(MAX_REFRESH_TTL_SECONDS, Math.max(MIN_REFRESH_TTL_SECONDS, clamped))
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

export const issueRefreshToken = (
  input: { user: string; role: 'admin' | 'user'; groups: string[] },
  options: { ttlSeconds: number; hashSecret: string }
) => {
  cleanupRefreshSessions()
  return createRefreshSession(input, options.ttlSeconds, options.hashSecret)
}

export const rotateRefreshToken = (
  refreshToken: string,
  options: { ttlSeconds: number; hashSecret: string }
) => {
  cleanupRefreshSessions()

  const tokenHash = hashRefreshToken(refreshToken, options.hashSecret)
  const sessionId = refreshSessionIdByHash.get(tokenHash)
  if (!sessionId) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  const now = Math.floor(Date.now() / 1000)
  const session = refreshSessionsById.get(sessionId)
  if (!session) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  if (session.expiresAt <= now) {
    session.revokedAt = now
    return { ok: false as const, reason: 'expired' as const }
  }

  if (session.revokedAt !== null) {
    if (session.replacedBy) {
      revokeFamily(session.familyId, now)
      return { ok: false as const, reason: 'reuse' as const }
    }
    return { ok: false as const, reason: 'revoked' as const }
  }

  const next = createRefreshSession(
    {
      user: session.user,
      role: session.role,
      groups: session.groups,
      familyId: session.familyId
    },
    options.ttlSeconds,
    options.hashSecret,
    now
  )

  session.revokedAt = now
  session.replacedBy = next.session.id

  return {
    ok: true as const,
    refreshToken: next.refreshToken,
    refreshExp: next.exp,
    session: next.session
  }
}

export const revokeRefreshFamilyByToken = (refreshToken: string, hashSecret: string) => {
  cleanupRefreshSessions()
  const tokenHash = hashRefreshToken(refreshToken, hashSecret)
  const sessionId = refreshSessionIdByHash.get(tokenHash)
  if (!sessionId) {
    return false
  }
  const session = refreshSessionsById.get(sessionId)
  if (!session) {
    return false
  }
  revokeFamily(session.familyId)
  return true
}
