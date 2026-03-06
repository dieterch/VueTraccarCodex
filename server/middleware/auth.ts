import { createError, defineEventHandler, getHeader, setResponseStatus } from 'h3'
import { buildAuthContext, getJwtFromCookie, isAuthBypassEnabled, verifyJwt } from '~/server/utils/auth'
import { parseBearerToken } from '~/server/utils/mobile-auth'

export default defineEventHandler(async (event) => {
  const path = String(event.path || '')
  const pathname = path.split('?')[0]
  if (!path.startsWith('/api/')) {
    return
  }

  const isMobileApi = pathname.startsWith('/api/mobile/')
  const isMobileAuthPublicPath =
    pathname === '/api/mobile/auth/login' ||
    pathname === '/api/mobile/auth/refresh' ||
    pathname === '/api/mobile/auth/logout'
  if (isMobileAuthPublicPath) {
    console.info('[auth] mobile auth public route bypassed')
    return
  }

  if (pathname.startsWith('/api/auth/')) {
    console.info('[auth] web auth namespace bypassed')
    return
  }

  if (isMobileApi) {
    const mobileBearer = parseBearerToken(getHeader(event, 'authorization'))
    if (!mobileBearer) {
      console.info('[auth] mobile unauthorized (missing bearer token)')
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }

    try {
      const payload = await verifyJwt(mobileBearer)
      event.context.auth = buildAuthContext(payload)
      console.info('[auth] mobile bearer token accepted')
      return
    } catch {
      console.warn('[auth] mobile bearer token rejected')
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }
  }

  if (isAuthBypassEnabled()) {
    const role = String(useRuntimeConfig().authBypassRole || 'admin')
    event.context.auth = {
      user: 'dev',
      role: role === 'admin' ? 'admin' : 'user',
      groups: role === 'admin' ? ['admins'] : [],
      exp: Math.floor(Date.now() / 1000) + 3600
    }
    console.info('[auth] bypass enabled in non-production')
    return
  }

  const bearerToken = parseBearerToken(getHeader(event, 'authorization'))
  if (bearerToken) {
    try {
      const payload = await verifyJwt(bearerToken)
      event.context.auth = buildAuthContext(payload)
      console.info('[auth] bearer token accepted')
      return
    } catch {
      console.warn('[auth] bearer token rejected')
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }
  }

  const cookieToken = getJwtFromCookie(event)
  const token = cookieToken
  if (!token) {
    console.info('[auth] no bearer token, falling back to cookie/web flow')
    if (isMobileApi) {
      console.info('[auth] mobile unauthorized (missing token)')
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }
    throw createError({ statusCode: 401, message: 'Missing auth token' })
  }

  try {
    const payload = await verifyJwt(token)
    event.context.auth = buildAuthContext(payload)
    if (isMobileApi) {
      console.info('[auth] mobile authorized via cookie JWT')
    }
  } catch {
    console.warn('[auth] cookie JWT rejected')
    if (isMobileApi) {
      console.info('[auth] mobile unauthorized (invalid token)')
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }
    throw createError({ statusCode: 401, message: 'Invalid auth token' })
  }
})
