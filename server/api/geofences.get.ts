import { TraccarService } from '~/server/services/traccar.service'

export default defineEventHandler(async (event) => {
  try {
    const traccar = new TraccarService()
    const geofences = await traccar.getGeofences()

    return {
      success: true,
      geofences
    }
  } catch (error: any) {
    console.error('Error fetching geofences:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch geofences'
    })
  }
})
