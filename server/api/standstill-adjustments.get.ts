import { getStandstillAdjustment } from '~/server/utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const standstillKey = query.key as string

    if (!standstillKey) {
      throw createError({
        statusCode: 400,
        message: 'Standstill key is required'
      })
    }

    const adjustment = getStandstillAdjustment(standstillKey)

    return {
      success: true,
      adjustment: adjustment || {
        standstill_key: standstillKey,
        start_adjustment_minutes: 0,
        end_adjustment_minutes: 0
      }
    }
  } catch (error: any) {
    console.error('Error loading standstill adjustment:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to load standstill adjustment'
    })
  }
})
