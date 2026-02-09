import { createError, defineEventHandler, setCookie } from 'h3'
import { getAutheliaUser, issueJwt, isAuthBypassEnabled } from '~/server/utils/auth'
import { logUserEvent } from '~/server/utils/userLog'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

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

  const { user, groups } = getAutheliaUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Missing forward-auth user' })
  }

  const { token, exp, role } = await issueJwt({ user, groups })
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
    user,
    role
  })

  return {
    success: true,
    user,
    role,
    exp
  }
})
