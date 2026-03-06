import { defineEventHandler, readBody } from 'h3'
import { revokeRefreshFamilyByToken } from '~/server/utils/mobile-auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event).catch(() => ({}))
  const refreshToken = String(body?.refreshToken || '').trim()

  if (!refreshToken) {
    console.info('[auth] mobile logout without refresh token')
    return { success: true }
  }

  const refreshHashSecret = String(config.mobileRefreshTokenHashSecret || config.jwtSecret || '')
  revokeRefreshFamilyByToken(refreshToken, refreshHashSecret)
  console.info('[auth] mobile logout success')
  return { success: true }
})
