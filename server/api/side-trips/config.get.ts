import { createError } from 'h3'
import { readFile } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'

export default defineEventHandler(async () => {
  const buildSideTripConfig = (data: any) => ({
    sideTripEnabled: data.sideTripEnabled !== undefined ? data.sideTripEnabled : false,
    sideTripDevices: data.sideTripDevices ?? [],
    sideTripBufferHours: data.sideTripBufferHours !== undefined ? data.sideTripBufferHours : 6
  })

  try {
    const yamlPath = join(process.cwd(), 'data', 'settings.yml')
    const content = await readFile(yamlPath, 'utf-8')
    const data = parseYaml(content) || {}

    return {
      success: true,
      settings: buildSideTripConfig(data)
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {
        success: true,
        settings: buildSideTripConfig({})
      }
    }

    console.error('Error loading side trip settings:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to load side trip settings'
    })
  }
})
