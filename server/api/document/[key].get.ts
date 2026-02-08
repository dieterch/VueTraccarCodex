import { createDocumentManager } from '../../services/document-manager'

export default defineEventHandler(async (event) => {
  try {
    const key = getRouterParam(event, 'key')

    if (!key) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing document key'
      })
    }

    const documentManager = createDocumentManager()
    const content = await documentManager.getDocument(key)

    return { content }
  } catch (error: any) {
    console.error('Error in /api/document/[key] GET:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to load document'
    })
  }
})
