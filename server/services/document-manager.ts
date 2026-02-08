import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { createWordPressClient } from '../utils/wordpress-client'

export class DocumentManager {
  private client = createWordPressClient()

  /**
   * Get document by key
   */
  async getDocument(key: string): Promise<string> {
    try {
      const filePath = join(process.cwd(), 'data', 'documents', `${key}.rst`)
      let content = await readFile(filePath, 'utf-8')

      // Transform WordPress URLs based on home mode
      content = this.client.transformContent(content)

      return content
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`Document ${key} not found, returning empty content`)
        return ''
      }
      console.error(`Error reading document ${key}:`, error)
      throw error
    }
  }

  /**
   * Save document by key
   */
  async saveDocument(key: string, content: string): Promise<void> {
    try {
      // Transform WordPress URLs before saving
      let transformedContent = this.client.transformContent(content)

      // Transform markdown links to HTML format
      // Convert [text](url) to `text <url>`_
      transformedContent = transformedContent.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '`$1 <$2>`_'
      )

      const filePath = join(process.cwd(), 'data', 'documents', `${key}.rst`)
      await writeFile(filePath, transformedContent, 'utf-8')

      console.log(`Document ${key} saved successfully`)
    } catch (error) {
      console.error(`Error saving document ${key}:`, error)
      throw error
    }
  }

  /**
   * Transform WordPress URLs in content
   */
  transformWordPressUrls(content: string): string {
    return this.client.transformContent(content)
  }
}

export function createDocumentManager(): DocumentManager {
  return new DocumentManager()
}
