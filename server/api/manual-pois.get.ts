import { getAllManualPOIs } from '../utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const pois = getAllManualPOIs()
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
