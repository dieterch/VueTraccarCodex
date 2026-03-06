import {
  normalizeStrictPublicSettingsPayload,
  savePublicSettings
} from '~/server/utils/public-settings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody(event)
  const payload = normalizeStrictPublicSettingsPayload(body)
  const settings = await savePublicSettings(payload, { preserveUnknownSettings: true })

  return {
    success: true,
    message: 'Settings saved successfully',
    settings
  }
})
