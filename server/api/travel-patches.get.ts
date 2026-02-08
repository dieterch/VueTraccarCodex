import { getTravelPatches } from '~/server/utils/app-db'

export default defineEventHandler(async () => {
  try {
    const patches = getTravelPatches()
    return { success: true, patches }
  } catch (error: any) {
    console.error('Error fetching travel patches:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch travel patches'
    })
  }
})
