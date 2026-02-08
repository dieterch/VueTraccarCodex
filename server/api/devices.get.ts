import { TraccarService } from '~/server/services/traccar.service'

export default defineEventHandler(async (event) => {
  try {
    const traccar = new TraccarService()
    const devices = await traccar.getDevices()

    return {
      success: true,
      devices
    }
  } catch (error: any) {
    console.error('Error fetching devices:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch devices'
    })
  }
})
