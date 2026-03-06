import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { issueJwtWithTtl } from '~/server/utils/auth'
import { normalizeMobileTtlSeconds, normalizeRefreshTtlSeconds, rotateRefreshToken } from '~/server/utils/mobile-auth'

const unauthorized = (event: any) => {
  setResponseStatus(event, 401)
  return { error: 'unauthorized' }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event).catch(() => ({}))
  const refreshToken = String(body?.refreshToken || '').trim()
  if (!refreshToken) {
    console.warn('[auth] mobile refresh denied (missing refresh token)')
    return unauthorized(event)
  }

  const refreshTtlSeconds = normalizeRefreshTtlSeconds(config.mobileRefreshTokenTtlSeconds)
  const accessTtlSeconds = normalizeMobileTtlSeconds(config.mobileJwtTtlSeconds)
  const refreshHashSecret = String(config.mobileRefreshTokenHashSecret || config.jwtSecret || '')

  const rotated = rotateRefreshToken(refreshToken, {
    ttlSeconds: refreshTtlSeconds,
    hashSecret: refreshHashSecret
  })

  if (!rotated.ok) {
    if (rotated.reason === 'reuse') {
      console.warn('[auth] mobile refresh denied (refresh token reuse detected)')
    } else {
      console.warn('[auth] mobile refresh denied (invalid refresh token)')
    }
    return unauthorized(event)
  }

  const { token, exp, role } = await issueJwtWithTtl(
    {
      user: rotated.session.user,
      groups: rotated.session.groups
    },
    accessTtlSeconds
  )

  console.info('[auth] mobile refresh success')
  return {
    success: true,
    accessToken: token,
    exp,
    refreshToken: rotated.refreshToken,
    refreshExp: rotated.refreshExp,
    user: rotated.session.user,
    role
  }
})
