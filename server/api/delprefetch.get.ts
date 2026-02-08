import { createTraccarService } from '../services/traccar.service'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const deviceId = query.deviceId ? parseInt(query.deviceId as string) : undefined

    if (!deviceId) {
      const config = useRuntimeConfig()
      const defaultDeviceId = parseInt(config.traccarDeviceId as string)

      const traccarService = createTraccarService()
      const result = await traccarService.deletePrefetch(defaultDeviceId)

      return { message: result }
    }

    const traccarService = createTraccarService()
    const result = await traccarService.deletePrefetch(deviceId)

    return { message: result }
  } catch (error: any) {
    console.error('Error in /api/delprefetch:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to delete prefetch cache'
    })
  }
})
