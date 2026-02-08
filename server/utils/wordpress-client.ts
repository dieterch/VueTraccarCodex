import type { WordPressPost } from '~/types/wordpress'

export class WordPressClient {
  private baseUrl: string
  private auth: { username: string; password: string }
  private homeMode: boolean

  constructor(baseUrl: string, username: string, appPassword: string, homeMode: boolean) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.auth = { username, password: appPassword }
    this.homeMode = homeMode
  }

  private getHeaders() {
    const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64')
    return {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json'
    }
  }

  /**
   * Transform URL based on home mode setting
   */
  transformUrl(url: string): string {
    if (!url || typeof url !== 'string') return url

    if (this.homeMode) {
      // Transform cloud URL to home URL
      return url.replace('tagebuch.smallfamilybusiness.net', 'tagebuch.home.smallfamilybusiness.net')
    } else {
      // Transform home URL back to cloud URL
      return url.replace('tagebuch.home.smallfamilybusiness.net', 'tagebuch.smallfamilybusiness.net')
    }
  }

  /**
   * Transform content URLs based on home mode setting
   */
  transformContent(content: string): string {
    if (!content || typeof content !== 'string') return content

    if (this.homeMode) {
      return content.replace(/tagebuch\.smallfamilybusiness\.net/g, 'tagebuch.home.smallfamilybusiness.net')
    } else {
      return content.replace(/tagebuch\.home\.smallfamilybusiness\.net/g, 'tagebuch.smallfamilybusiness.net')
    }
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
  }

  /**
   * Get posts by tag name
   */
  async getPostsByTag(tag: string, limit: number = 10): Promise<WordPressPost[]> {
    try {
      // Search for tag (case-insensitive)
      const tagsUrl = `${this.baseUrl}/wp-json/wp/v2/tags`
      const tagsParams = new URLSearchParams({
        search: tag,
        per_page: '10'
      })

      const tagsResponse = await $fetch<any[]>(`${tagsUrl}?${tagsParams}`, {
        headers: this.getHeaders(),
        timeout: 30000
      })

      // Find exact match (case-insensitive)
      const tagItem = tagsResponse.find(t => t.name.toLowerCase() === tag.toLowerCase())

      if (!tagItem) {
        console.log(`WordPress: No tag found for '${tag}'`)
        return []
      }

      console.log(`WordPress: Found tag '${tag}' (name: '${tagItem.name}') with ID ${tagItem.id}`)

      // Get posts with this tag
      const postsUrl = `${this.baseUrl}/wp-json/wp/v2/posts`
      const postsParams = new URLSearchParams({
        tags: tagItem.id.toString(),
        per_page: limit.toString(),
        status: 'publish',
        _embed: 'true'
      })

      const posts = await $fetch<any[]>(`${postsUrl}?${postsParams}`, {
        headers: this.getHeaders(),
        timeout: 30000
      })

      // Process posts
      const processed = posts.map(post => {
        // Extract featured image
        let featuredImage = null
        if (post._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
          featuredImage = this.transformUrl(post._embedded['wp:featuredmedia'][0].source_url)
        }

        return {
          id: post.id,
          date: post.date,
          date_gmt: post.date_gmt,
          modified: post.modified,
          modified_gmt: post.modified_gmt,
          slug: post.slug,
          status: post.status,
          type: post.type,
          link: this.transformUrl(post.link),
          title: {
            rendered: this.decodeHtmlEntities(post.title.rendered)
          },
          content: {
            rendered: this.transformContent(this.decodeHtmlEntities(post.content.rendered)),
            protected: post.content.protected
          },
          excerpt: {
            rendered: this.transformContent(this.decodeHtmlEntities(post.excerpt.rendered)),
            protected: post.excerpt.protected
          },
          author: post.author,
          featured_media: post.featured_media,
          comment_status: post.comment_status,
          ping_status: post.ping_status,
          sticky: post.sticky,
          template: post.template,
          format: post.format,
          meta: post.meta,
          categories: post.categories,
          tags: post.tags,
          _links: post._links,
          featured_image: featuredImage
        } as WordPressPost
      })

      console.log(`WordPress: Found ${processed.length} posts for tag '${tag}'`)
      return processed
    } catch (error) {
      console.error(`WordPress API error for tag '${tag}':`, error)
      return []
    }
  }

  /**
   * Test connection to WordPress API
   */
  async testConnection(): Promise<boolean> {
    try {
      const testUrl = `${this.baseUrl}/wp-json/wp/v2`
      await $fetch(testUrl, {
        headers: this.getHeaders(),
        timeout: 10000
      })

      console.log(`WordPress: Connection successful to ${this.baseUrl}`)
      return true
    } catch (error) {
      console.error(`WordPress: Connection failed -`, error)
      return false
    }
  }
}

export function createWordPressClient(): WordPressClient {
  const config = useRuntimeConfig()
  return new WordPressClient(
    config.wordpressUrl as string,
    config.wordpressUser as string,
    config.wordpressAppPassword as string,
    config.homeMode as boolean
  )
}
