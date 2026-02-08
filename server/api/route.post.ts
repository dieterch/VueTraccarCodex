import { createTraccarService } from '../services/traccar.service'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { deviceId, from, to } = body

    if (!deviceId || !from || !to) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: deviceId, from, to'
      })
    }

    const traccarService = createTraccarService()
    const route = await traccarService.getRouteData(deviceId, from, to)

    return route
  } catch (error: any) {
    console.error('Error in /api/route:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch route'
    })
  }
})
