import { getPublicSettings } from '~/server/utils/public-settings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  return {
    success: true,
    settings: await getPublicSettings()
  }
})
