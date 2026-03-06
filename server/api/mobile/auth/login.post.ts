import { defineEventHandler, getRequestIP, readBody, setResponseStatus } from 'h3'
import { issueJwtWithTtl } from '~/server/utils/auth'
import {
  clearLoginRateLimit,
  consumeLoginRateLimit,
  normalizeMobileTtlSeconds,
  normalizeRefreshTtlSeconds,
  issueRefreshToken,
  registerFailedLogin,
  secureStringEqual,
  verifyScryptPassword
} from '~/server/utils/mobile-auth'

const unauthorized = (event: any) => {
  setResponseStatus(event, 401)
  return { error: 'unauthorized' }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event).catch(() => ({}))
  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateKey = `${requestIp}:${username || 'unknown'}`

  const limitState = consumeLoginRateLimit(rateKey)
  if (!limitState.allowed) {
    console.warn('[auth] mobile login blocked by rate limit')
    setResponseStatus(event, 429)
    return {
      error: 'too_many_requests',
      retryAfterMs: limitState.retryAfterMs
    }
  }

  const configuredUsername = String(config.mobileAuthUsername || '').trim()
  const configuredHash = String(config.mobileAuthPasswordHash || '')

  const usernameValid = configuredUsername !== '' && secureStringEqual(username, configuredUsername)
  const passwordValid = configuredHash !== '' && verifyScryptPassword(password, configuredHash)

  if (!usernameValid || !passwordValid) {
    registerFailedLogin(rateKey)
    console.warn('[auth] mobile login failed')
    return unauthorized(event)
  }

  clearLoginRateLimit(rateKey)

  const role = String(config.mobileAuthRole || 'user') === 'admin' ? 'admin' : 'user'
  const adminGroup = String(config.adminGroup || 'admins')
  const groups = role === 'admin' ? [adminGroup] : []
  const ttlSeconds = normalizeMobileTtlSeconds(config.mobileJwtTtlSeconds)
  const refreshTtlSeconds = normalizeRefreshTtlSeconds(config.mobileRefreshTokenTtlSeconds)
  const refreshHashSecret = String(config.mobileRefreshTokenHashSecret || config.jwtSecret || '')
  const { token, exp, role: issuedRole } = await issueJwtWithTtl(
    {
      user: configuredUsername,
      groups
    },
    ttlSeconds
  )
  const refresh = issueRefreshToken(
    {
      user: configuredUsername,
      role,
      groups
    },
    {
      ttlSeconds: refreshTtlSeconds,
      hashSecret: refreshHashSecret
    }
  )

  console.info('[auth] mobile login success')
  return {
    success: true,
    accessToken: token,
    exp,
    refreshToken: refresh.refreshToken,
    refreshExp: refresh.exp,
    user: configuredUsername,
    role: issuedRole
  }
})
