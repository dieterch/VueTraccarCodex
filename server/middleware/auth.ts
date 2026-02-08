import { createError, defineEventHandler } from 'h3'
import { buildAuthContext, getJwtFromCookie, isAuthBypassEnabled, verifyJwt } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) {
    return
  }

  if (path.startsWith('/api/auth/')) {
    return
  }

  if (isAuthBypassEnabled()) {
    const role = String(useRuntimeConfig().authBypassRole || 'admin')
    event.context.auth = {
      user: 'dev',
      role: role === 'admin' ? 'admin' : 'user',
      groups: role === 'admin' ? ['admins'] : [],
      exp: Math.floor(Date.now() / 1000) + 3600
    }
    return
  }

  const token = getJwtFromCookie(event)
  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing auth token' })
  }

  try {
    const payload = await verifyJwt(token)
    event.context.auth = buildAuthContext(payload)
  } catch (error) {
    throw createError({ statusCode: 401, message: 'Invalid auth token' })
  }
})
