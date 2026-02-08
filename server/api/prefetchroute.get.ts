import { createTraccarService } from '../services/traccar.service'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const deviceId = query.deviceId ? parseInt(query.deviceId as string) : undefined

    if (!deviceId) {
      const config = useRuntimeConfig()
      const defaultDeviceId = parseInt(config.traccarDeviceId as string)

      const traccarService = createTraccarService()
      const result = await traccarService.prefetchRouteData(defaultDeviceId)

      return result
    }

    const traccarService = createTraccarService()
    const result = await traccarService.prefetchRouteData(deviceId)

    return result
  } catch (error: any) {
    console.error('Error in /api/prefetchroute:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to prefetch route data'
    })
  }
})
