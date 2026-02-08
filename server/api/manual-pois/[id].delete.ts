import { deleteManualPOI } from '../../utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      return {
        success: false,
        error: 'POI ID is required'
      }
    }

    const poiId = parseInt(id, 10)
    if (isNaN(poiId)) {
      return {
        success: false,
        error: 'Invalid POI ID'
      }
    }

    deleteManualPOI(poiId)

    return {
      success: true
    }
  } catch (error: any) {
    console.error('Error deleting manual POI:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
