import { randomUUID } from 'crypto'
import { replaceManualTravelPositions } from '../../../utils/app-db'

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
    const positions = Array.isArray(body?.positions) ? body.positions : []

    if (positions.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'positions array is required'
      })
    }

    const normalized = positions.map((pos: any) => ({
      id: randomUUID(),
      fixTime: pos.fixTime || pos.fix_time,
      latitude: Number(pos.latitude),
      longitude: Number(pos.longitude),
      speed: pos.speed ?? null,
      altitude: pos.altitude ?? null,
      attributes: pos.attributes ? JSON.stringify(pos.attributes) : null
    }))

    replaceManualTravelPositions(travelId, normalized)

    return { success: true }
  } catch (error: any) {
    console.error('Error saving manual travel positions:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to save manual travel positions'
    })
  }
})
