import { writeFile, readFile } from 'fs/promises'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()

    // Load existing settings to preserve unchanged passwords
    let existingSettings: any = {}
    try {
      const yamlPath = join(process.cwd(), 'data', 'settings.yml')
      const content = await readFile(yamlPath, 'utf-8')
      existingSettings = parseYaml(content) || {}
    } catch (error: any) {
      // If file doesn't exist, use config defaults
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    // Helper to check if a value is masked or empty (means "don't change")
    const shouldKeepExisting = (value: string | undefined | null): boolean => {
      return !value || value === '••••••••'
    }

    // Build settings object with all provided values
    const settings: any = {}

    // Traccar API
    if (body.traccarUrl) settings.traccarUrl = body.traccarUrl
    if (body.traccarUser) settings.traccarUser = body.traccarUser
    // Only update password if a new value is provided (not masked)
    if (shouldKeepExisting(body.traccarPassword)) {
      settings.traccarPassword = existingSettings.traccarPassword || config.traccarPassword
    } else {
      settings.traccarPassword = body.traccarPassword
    }
    if (body.traccarDeviceId) settings.traccarDeviceId = parseInt(body.traccarDeviceId)
    if (body.traccarDeviceName) settings.traccarDeviceName = body.traccarDeviceName

    // Google Maps
    if (shouldKeepExisting(body.googleMapsApiKey)) {
      settings.googleMapsApiKey = existingSettings.googleMapsApiKey || config.public.googleMapsApiKey
    } else {
      settings.googleMapsApiKey = body.googleMapsApiKey
    }
    if (body.googleMapsMapId) settings.googleMapsMapId = body.googleMapsMapId

    // WordPress
    if (body.wordpressUrl) settings.wordpressUrl = body.wordpressUrl
    if (body.wordpressUser) settings.wordpressUser = body.wordpressUser
    if (shouldKeepExisting(body.wordpressAppPassword)) {
      settings.wordpressAppPassword = existingSettings.wordpressAppPassword || config.wordpressAppPassword
    } else {
      settings.wordpressAppPassword = body.wordpressAppPassword
    }
    if (body.wordpressCacheDuration) settings.wordpressCacheDuration = parseInt(body.wordpressCacheDuration)

    // Application
    if (shouldKeepExisting(body.vueTraccarPassword)) {
      settings.vueTraccarPassword = existingSettings.vueTraccarPassword || config.vueTraccarPassword
    } else {
      settings.vueTraccarPassword = body.vueTraccarPassword
    }
    if (shouldKeepExisting(body.settingsPassword)) {
      settings.settingsPassword = existingSettings.settingsPassword || config.settingsPassword
    } else {
      settings.settingsPassword = body.settingsPassword
    }
    if (body.homeMode !== undefined) settings.homeMode = body.homeMode
    if (body.homeLatitude) settings.homeLatitude = body.homeLatitude
    if (body.homeLongitude) settings.homeLongitude = body.homeLongitude

    // Home Geofence
    if (body.homeGeofenceId) settings.homeGeofenceId = parseInt(body.homeGeofenceId)
    if (body.homeGeofenceName) settings.homeGeofenceName = body.homeGeofenceName

    // Route Analysis
    if (body.eventMinGap) settings.eventMinGap = parseInt(body.eventMinGap)
    if (body.maxDays) settings.maxDays = parseInt(body.maxDays)
    if (body.minDays) settings.minDays = parseInt(body.minDays)
    if (body.standPeriod) settings.standPeriod = parseInt(body.standPeriod)
    if (body.startDate) settings.startDate = body.startDate

    // Side Trip Tracking
    if (body.sideTripEnabled !== undefined) settings.sideTripEnabled = body.sideTripEnabled
    if (body.sideTripDevices !== undefined) settings.sideTripDevices = body.sideTripDevices
    if (body.sideTripBufferHours !== undefined) settings.sideTripBufferHours = parseInt(body.sideTripBufferHours)

    const yamlPath = join(process.cwd(), 'data', 'settings.yml')
    const yamlContent = stringifyYaml(settings)

    await writeFile(yamlPath, yamlContent, 'utf-8')

    console.log('Settings saved:', settings)

    return {
      success: true,
      message: 'Settings saved successfully',
      settings
    }
  } catch (error: any) {
    console.error('Error saving settings:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to save settings'
    })
  }
})
