import { defineEventHandler, setCookie } from 'h3'
import { buildAuthContext, getJwtFromCookie, isAuthBypassEnabled, verifyJwt } from '~/server/utils/auth'
import { logUserEvent } from '~/server/utils/userLog'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cookieName = String(config.authCookieName || 'vt_auth')

  let user = ''
  let role = ''
  if (isAuthBypassEnabled()) {
    user = 'dev'
    role = String(config.authBypassRole || 'admin')
  } else {
    const token = getJwtFromCookie(event)
    if (token) {
      try {
        const payload = await verifyJwt(token)
        const authContext = buildAuthContext(payload)
        user = authContext.user
        role = authContext.role
      } catch (error) {
        console.warn('Failed to verify JWT for logout logging:', error)
      }
    }
  }

  setCookie(event, cookieName, '', {
    httpOnly: true,
    secure: Boolean(config.authCookieSecure),
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })

  await logUserEvent(event, {
    action: 'logout',
    user: user || 'unknown',
    role: role || 'unknown'
  })

  return { success: true }
})
