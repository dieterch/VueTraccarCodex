import { createTraccarService } from '../services/traccar.service'
import { createTravelAnalyzer } from '../services/travel-analyzer'
import { getManualTravels, getManualTravelPositions } from '../utils/app-db'
import { calculateDistance } from '../services/route-analyzer'

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

    // Analyze auto travels
    const autoTravels = await travelAnalyzer.analyzeTravels(events, standstills, deviceId)

    const normalizedAuto = autoTravels.map((travel: any) => ({
      ...travel,
      id: `auto-${deviceId}-${travel.von}-${travel.bis}`.replace(/\s+/g, ''),
      source: 'auto',
      deviceId
    }))

    // Load manual travels
    const manualTravels = getManualTravels().map((manual: any) => {
      const positions = getManualTravelPositions(manual.id)
      const distance = calculateManualDistance(positions)

      return {
        id: manual.id,
        title: manual.title,
        von: manual.from_date,
        bis: manual.to_date,
        distance,
        source: 'manual',
        deviceId: manual.source_device_id,
        notes: manual.notes,
        created_at: manual.created_at
      }
    })

    const allTravels = [...normalizedAuto, ...manualTravels].sort((a, b) => {
      return new Date(a.von).getTime() - new Date(b.von).getTime()
    })

    return allTravels
  } catch (error: any) {
    console.error('Error in /api/travels:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to analyze travels'
    })
  }
})

function calculateManualDistance(positions: any[]): number {
  if (!positions || positions.length < 2) return 0

  let distance = 0
  for (let i = 0; i < positions.length - 1; i++) {
    distance += calculateDistance(
      { latitude: positions[i].latitude, longitude: positions[i].longitude },
      { latitude: positions[i + 1].latitude, longitude: positions[i + 1].longitude }
    )
  }
  return distance
}
