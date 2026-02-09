import { getManualTravels } from '../utils/app-db'

export default defineEventHandler(async () => {
  try {
    const travels = getManualTravels()
    return travels
  } catch (error: any) {
    console.error('Error fetching manual travels:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch manual travels'
    })
  }
})
