import { defineEventHandler } from 'h3'
import { buildAuthContext, getJwtFromCookie, isAuthBypassEnabled, verifyJwt } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (isAuthBypassEnabled()) {
    const role = String(config.authBypassRole || 'admin')
    return {
      authenticated: true,
      user: 'dev',
      role: role === 'admin' ? 'admin' : 'user',
      exp: Math.floor(Date.now() / 1000) + Number(config.jwtTtlSeconds || 3600)
    }
  }

  const token = getJwtFromCookie(event)
  if (!token) {
    return { authenticated: false }
  }

  try {
    const payload = await verifyJwt(token)
    const auth = buildAuthContext(payload)
    return {
      authenticated: true,
      user: auth.user,
      role: auth.role,
      exp: auth.exp
    }
  } catch {
    return { authenticated: false }
  }
})
