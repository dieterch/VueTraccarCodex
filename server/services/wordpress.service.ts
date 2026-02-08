import { createWordPressClient } from '../utils/wordpress-client'
import type { WordPressPost, WordPressCacheEntry } from '~/types/wordpress'

export class WordPressService {
  private client = createWordPressClient()
  private cache = new Map<string, WordPressCacheEntry>()
  private config = useRuntimeConfig()

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const cacheDuration = parseInt(this.config.wordpressCacheDuration as string) || 3600
    const age = (Date.now() - entry.timestamp) / 1000

    return age < cacheDuration
  }

  /**
   * Cache posts
   */
  private cachePosts(key: string, posts: WordPressPost[]) {
    this.cache.set(key, {
      posts,
      timestamp: Date.now()
    })
  }

  /**
   * Get posts by tag with caching
   */
  async getPostsByTag(tag: string, limit: number = 10): Promise<WordPressPost[]> {
    const cacheKey = `${tag.toLowerCase()}_${limit}`

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`WordPress: Using cached posts for tag '${tag}'`)
      return this.cache.get(cacheKey)!.posts
    }

    // Fetch from API
    const posts = await this.client.getPostsByTag(tag, limit)

    // Cache results
    this.cachePosts(cacheKey, posts)

    return posts
  }

  /**
   * Get posts for multiple tags
   */
  async getPostsByMultipleTags(
    tags: string[],
    limit: number = 50
  ): Promise<Record<string, WordPressPost[]>> {
    const results: Record<string, WordPressPost[]> = {}

    for (const tag of tags) {
      results[tag] = await this.getPostsByTag(tag, limit)
    }

    return results
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
    console.log('WordPress: Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cached_keys: Array.from(this.cache.keys()),
      cache_size: this.cache.size,
      cache_timestamps: Object.fromEntries(
        Array.from(this.cache.entries()).map(([key, value]) => [key, value.timestamp])
      )
    }
  }

  /**
   * Test WordPress connection
   */
  async testConnection(): Promise<boolean> {
    return await this.client.testConnection()
  }
}

export function createWordPressService(): WordPressService {
  return new WordPressService()
}
