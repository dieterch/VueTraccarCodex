import { deleteStandstillAdjustmentByKey } from '../../utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const key = getRouterParam(event, 'key')

    if (!key) {
      return {
        success: false,
        error: 'Standstill key is required'
      }
    }

    deleteStandstillAdjustmentByKey(key)

    return {
      success: true
    }
  } catch (error: any) {
    console.error('Error deleting standstill adjustment:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
