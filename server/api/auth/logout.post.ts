import { defineEventHandler, setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cookieName = String(config.authCookieName || 'vt_auth')

  setCookie(event, cookieName, '', {
    httpOnly: true,
    secure: Boolean(config.authCookieSecure),
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })

  return { success: true }
})
