import { createWordPressService } from '../../../services/wordpress.service'

export default defineEventHandler(async (event) => {
  try {
    const tag = getRouterParam(event, 'tag')

    if (!tag) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing tag parameter'
      })
    }

    const query = getQuery(event)
    const limit = query.limit ? parseInt(query.limit as string) : 10

    const wordpressService = createWordPressService()
    const posts = await wordpressService.getPostsByTag(tag, limit)

    return posts
  } catch (error: any) {
    console.error('Error in /api/wordpress/posts/[tag]:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch WordPress posts'
    })
  }
})
