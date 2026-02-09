import { deleteManualTravel } from '../../utils/app-db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  try {
    const travelId = getRouterParam(event, 'id')

    if (!travelId) {
      return {
        success: false,
        error: 'Travel ID is required'
      }
    }

    deleteManualTravel(travelId)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting manual travel:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
