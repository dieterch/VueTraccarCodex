import { getAllManualPOIs, getManualPOIsForRange } from '../utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const deviceId = query.deviceId ? Number(query.deviceId) : null
    const from = query.from ? String(query.from) : null
    const to = query.to ? String(query.to) : null

    const pois = deviceId && from && to
      ? getManualPOIsForRange(deviceId, from, to)
      : getAllManualPOIs()
    return {
      success: true,
      pois
    }
  } catch (error: any) {
    console.error('Error fetching manual POIs:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
