import { deleteManualTravel } from '../../utils/app-db'

export default defineEventHandler(async (event) => {
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
