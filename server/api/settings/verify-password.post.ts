export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()

    if (!body.password) {
      throw createError({
        statusCode: 400,
        message: 'Password is required'
      })
    }

    const isValid = body.password === config.settingsPassword

    return {
      success: true,
      valid: isValid
    }
  } catch (error: any) {
    console.error('Error verifying settings password:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to verify password'
    })
  }
})
