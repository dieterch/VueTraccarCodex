import { randomUUID } from 'crypto'
import { createManualTravel } from '../utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { title, source_device_id, from_date, to_date, notes } = body || {}

    if (!title || !source_device_id || !from_date || !to_date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: title, source_device_id, from_date, to_date'
      })
    }

    const id = randomUUID()

    createManualTravel({
      id,
      title,
      sourceDeviceId: Number(source_device_id),
      fromDate: from_date,
      toDate: to_date,
      notes
    })

    return { id }
  } catch (error: any) {
    console.error('Error creating manual travel:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to create manual travel'
    })
  }
})
