import { getManualTravelPositions } from '../../../utils/app-db'

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

    const positions = getManualTravelPositions(travelId).map(pos => ({
      id: pos.id,
      travel_id: pos.travel_id,
      fix_time: pos.fix_time,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      altitude: pos.altitude,
      attributes: pos.attributes ? safeParseJson(pos.attributes) : null
    }))

    return positions
  } catch (error: any) {
    console.error('Error fetching manual travel positions:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch manual travel positions'
    })
  }
})

function safeParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
