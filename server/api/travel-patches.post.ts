import { saveTravelPatch } from '~/server/utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { addressKey, title, fromDate, toDate, exclude } = body

    if (!addressKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'addressKey is required'
      })
    }

    saveTravelPatch({ addressKey, title, fromDate, toDate, exclude })

    return { success: true }
  } catch (error: any) {
    console.error('Error saving travel patch:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to save travel patch'
    })
  }
})
