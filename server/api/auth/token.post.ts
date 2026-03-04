import { defineEventHandler, getHeader, getRequestIP, setCookie, setResponseStatus } from 'h3'
import {
  getValidatedForwardAuthIdentity,
  isForwardAuthTrustedMarkerEnforced,
  isTrustedForwardAuthContext,
  issueJwt,
  isAuthBypassEnabled
} from '~/server/utils/auth'
import { logUserEvent } from '~/server/utils/userLog'

const denyUnauthorized = (event: any, reason: string) => {
  const requestId = String(getHeader(event, 'x-request-id') || '')
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  console.warn('[security] auth_token_denied', {
    reason,
    path: String(event.path || ''),
    requestId: requestId || null,
    requestIp
  })
  setResponseStatus(event, 401)
  return { error: 'unauthorized' }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const enforceTrustedMarker = isForwardAuthTrustedMarkerEnforced()

  if (isAuthBypassEnabled()) {
    const role = String(config.authBypassRole || 'admin')
    await logUserEvent(event, {
      action: 'login',
      user: 'dev',
      role
    })
    return {
      success: true,
      user: 'dev',
      role,
      exp: Math.floor(Date.now() / 1000) + Number(config.jwtTtlSeconds || 3600)
    }
  }

  if (enforceTrustedMarker && !isTrustedForwardAuthContext(event)) {
    return denyUnauthorized(event, 'untrusted_forward_auth_context')
  }

  const identity = getValidatedForwardAuthIdentity(event)
  if (!identity) {
    return denyUnauthorized(event, 'invalid_forward_auth_identity_headers')
  }

  const { token, exp, role } = await issueJwt(identity)
  const cookieName = String(config.authCookieName || 'vt_auth')

  setCookie(event, cookieName, token, {
    httpOnly: true,
    secure: Boolean(config.authCookieSecure),
    sameSite: 'lax',
    path: '/',
    maxAge: Number(config.jwtTtlSeconds || 3600)
  })

  await logUserEvent(event, {
    action: 'login',
    user: identity.user,
    role
  })

  return {
    success: true,
    user: identity.user,
    role,
    exp
  }
})
