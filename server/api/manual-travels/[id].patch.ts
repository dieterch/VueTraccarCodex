import { updateManualTravel } from '../../utils/app-db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  try {
    const travelId = getRouterParam(event, 'id')
    if (!travelId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Travel ID is required'
      })
    }

    const body = await readBody(event)
    const { title, source_device_id, from_date, to_date, notes } = body || {}

    if (!title || !source_device_id || !from_date || !to_date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: title, source_device_id, from_date, to_date'
      })
    }

    const changes = updateManualTravel({
      id: travelId,
      title,
      sourceDeviceId: Number(source_device_id),
      fromDate: from_date,
      toDate: to_date,
      notes
    })

    if (changes === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Manual travel not found'
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error updating manual travel:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update manual travel'
    })
  }
})
