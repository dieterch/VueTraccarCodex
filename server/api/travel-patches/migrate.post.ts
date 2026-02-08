import { readFile } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'
import { saveTravelPatch } from '~/server/utils/app-db'

export default defineEventHandler(async () => {
  try {
    const yamlPath = join(process.cwd(), 'data', 'travels.yml')
    const content = await readFile(yamlPath, 'utf-8')
    const data = parseYaml(content) || {}

    let migratedCount = 0

    for (const [addressKey, entry] of Object.entries(data)) {
      if (entry && typeof entry === 'object') {
        saveTravelPatch({
          addressKey,
          title: (entry as any).title || undefined,
          fromDate: (entry as any).from || undefined,
          toDate: (entry as any).to || undefined,
          exclude: (entry as any).exclude || false
        })
        migratedCount++
      }
    }

    return {
      success: true,
      message: `Migrated ${migratedCount} travel patches from YAML to database`,
      count: migratedCount
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'travels.yml not found'
      })
    }
    console.error('Error migrating travel patches:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to migrate travel patches'
    })
  }
})
