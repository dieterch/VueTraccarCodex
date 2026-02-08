import { saveStandstillAdjustment } from '~/server/utils/app-db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body.standstillKey) {
      throw createError({
        statusCode: 400,
        message: 'Standstill key is required'
      })
    }

    saveStandstillAdjustment({
      standstillKey: body.standstillKey,
      startAdjustmentMinutes: body.startAdjustmentMinutes || 0,
      endAdjustmentMinutes: body.endAdjustmentMinutes || 0
    })

    return {
      success: true,
      message: 'Standstill adjustment saved successfully'
    }
  } catch (error: any) {
    console.error('Error saving standstill adjustment:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to save standstill adjustment'
    })
  }
})
