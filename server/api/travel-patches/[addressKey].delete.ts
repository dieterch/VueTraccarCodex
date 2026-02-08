import { deleteTravelPatch } from '~/server/utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const addressKey = getRouterParam(event, 'addressKey')

    if (!addressKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'addressKey is required'
      })
    }

    deleteTravelPatch(decodeURIComponent(addressKey))

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting travel patch:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to delete travel patch'
    })
  }
})
