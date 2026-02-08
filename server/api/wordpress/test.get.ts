import { createWordPressService } from '../../services/wordpress.service'

export default defineEventHandler(async (event) => {
  try {
    const wordpressService = createWordPressService()
    const isConnected = await wordpressService.testConnection()

    return {
      connected: isConnected,
      message: isConnected
        ? 'WordPress connection successful'
        : 'WordPress connection failed'
    }
  } catch (error: any) {
    console.error('Error in /api/wordpress/test:', error)
    return {
      connected: false,
      message: 'WordPress connection failed',
      error: error.message
    }
  }
})
