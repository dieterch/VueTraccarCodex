import { createError, defineEventHandler, getHeader, setResponseStatus } from 'h3'
import { buildAuthContext, getJwtFromCookie, isAuthBypassEnabled, verifyJwt } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) {
    return
  }

  const isMobileApi = path.startsWith('/api/mobile/')
  if (isMobileApi && path.startsWith('/api/mobile/auth/')) {
    console.info('[auth] mobile auth namespace bypassed:', path)
    return
  }

  if (path.startsWith('/api/auth/')) {
    console.info('[auth] web auth namespace bypassed:', path)
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
    console.info('[auth] bypass enabled in non-production:', path)
    return
  }

  const authHeader = String(getHeader(event, 'authorization') || '')
  const bearerToken = isMobileApi && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const cookieToken = getJwtFromCookie(event)
  const token = bearerToken || cookieToken

  if (!token) {
    if (isMobileApi) {
      console.info('[auth] mobile unauthorized (missing token):', path)
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }
    throw createError({ statusCode: 401, message: 'Missing auth token' })
  }

  try {
    const payload = await verifyJwt(token)
    event.context.auth = buildAuthContext(payload)
    if (isMobileApi) {
      console.info('[auth] mobile authorized via JWT:', path)
    }
  } catch (error) {
    if (isMobileApi) {
      console.info('[auth] mobile unauthorized (invalid token):', path)
      setResponseStatus(event, 401)
      return { error: 'unauthorized' }
    }
    throw createError({ statusCode: 401, message: 'Invalid auth token' })
  }
})
