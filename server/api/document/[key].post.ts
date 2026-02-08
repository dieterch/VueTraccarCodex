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

    const body = await readBody(event)
    const { content } = body

    if (content === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing content in request body'
      })
    }

    const documentManager = createDocumentManager()
    await documentManager.saveDocument(key, content)

    return { success: true, message: 'Document saved successfully' }
  } catch (error: any) {
    console.error('Error in /api/document/[key] POST:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to save document'
    })
  }
})
