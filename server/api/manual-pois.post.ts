import { saveManualPOI } from '../utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validate required fields
    if (!body.lat || !body.lng || !body.timestamp || !body.deviceId || !body.key) {
      return {
        success: false,
        error: 'Missing required fields: lat, lng, timestamp, deviceId, key'
      }
    }

    const poiId = saveManualPOI({
      poiKey: body.key,
      latitude: body.lat,
      longitude: body.lng,
      timestamp: body.timestamp,
      deviceId: body.deviceId,
      address: body.address,
      country: body.country
    })

    return {
      success: true,
      poiId
    }
  } catch (error: any) {
    console.error('Error creating manual POI:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
