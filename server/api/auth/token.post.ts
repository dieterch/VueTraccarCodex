import { createError, defineEventHandler, setCookie } from 'h3'
import { getAutheliaUser, issueJwt, isAuthBypassEnabled } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (isAuthBypassEnabled()) {
    return {
      success: true,
      user: 'dev',
      role: String(config.authBypassRole || 'admin'),
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

  return {
    success: true,
    user,
    role,
    exp
  }
})
