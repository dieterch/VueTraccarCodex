import { createTraccarService } from '../services/traccar.service'
import { createTravelAnalyzer } from '../services/travel-analyzer'

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
    const travelAnalyzer = createTravelAnalyzer()

    // Get events and standstill periods
    const events = await traccarService.getEvents(deviceId, from, to)
    const standstills = await traccarService.getStandstillPeriods(deviceId)

    // Analyze travels
    const travels = await travelAnalyzer.analyzeTravels(events, standstills, deviceId)

    return travels
  } catch (error: any) {
    console.error('Error in /api/travels:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to analyze travels'
    })
  }
})
