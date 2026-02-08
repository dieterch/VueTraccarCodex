import { hasCachedData } from '~/server/utils/cache'

export default defineEventHandler(async () => {
  try {
    const config = useRuntimeConfig()
    const deviceId = parseInt(config.traccarDeviceId as string)

    const hasCache = hasCachedData(deviceId)

    return {
      success: true,
      hasCache,
      deviceId
    }
  } catch (error: any) {
    console.error('Error checking cache status:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check cache status'
    })
  }
})
