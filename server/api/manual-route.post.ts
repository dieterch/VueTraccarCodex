import { createTraccarService } from '../services/traccar.service'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

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
    const route = await traccarService.getRouteDirect(deviceId, from, to)

    return route
  } catch (error: any) {
    console.error('Error in /api/manual-route:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch manual route'
    })
  }
})
