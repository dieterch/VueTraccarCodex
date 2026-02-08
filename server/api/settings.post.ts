import { writeFile, readFile } from 'fs/promises'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const auth = event.context.auth
    if (!auth || auth.role !== 'admin') {
      throw createError({ statusCode: 403, message: 'Admin access required' })
    }
    const body = await readBody(event)
    const config = useRuntimeConfig()

    const emptyStringKeys = Object.entries(body || {})
      .filter(([, value]) => typeof value === 'string' && value.trim() === '')
      .map(([key]) => key)
    if (emptyStringKeys.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Empty strings are not allowed for: ${emptyStringKeys.join(', ')}`
      })
    }

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

    const baseSettings = {
      // Traccar API
      traccarUrl: config.traccarUrl,
      traccarUser: config.traccarUser,
      traccarPassword: config.traccarPassword,
      traccarDeviceId: config.traccarDeviceId,
      traccarDeviceName: config.traccarDeviceName,

      // Google Maps
      googleMapsApiKey: config.public.googleMapsApiKey,
      googleMapsMapId: config.public.googleMapsMapId,

      // WordPress
      wordpressUrl: config.wordpressUrl,
      wordpressUser: config.wordpressUser,
      wordpressAppPassword: config.wordpressAppPassword,
      wordpressCacheDuration: config.wordpressCacheDuration,

      // Application
      vueTraccarPassword: config.vueTraccarPassword,
      settingsPassword: config.settingsPassword,
      homeMode: config.homeMode,
      homeLatitude: config.homeLatitude,
      homeLongitude: config.homeLongitude,

      // Home Geofence
      homeGeofenceId: config.homeGeofenceId,
      homeGeofenceName: config.homeGeofenceName,

      // Route Analysis
      eventMinGap: config.eventMinGap,
      maxDays: config.maxDays,
      minDays: config.minDays,
      standPeriod: config.standPeriod,
      startDate: config.startDate,

      // Side Trip Tracking
      sideTripEnabled: false,
      sideTripDevices: [],
      sideTripBufferHours: 6,
    }

    // Build settings object with all provided values
    const settings: any = { ...baseSettings, ...existingSettings }

    // Traccar API
    if (body.traccarUrl !== undefined) settings.traccarUrl = body.traccarUrl
    if (body.traccarUser !== undefined) settings.traccarUser = body.traccarUser
    if (body.traccarPassword !== undefined) settings.traccarPassword = body.traccarPassword
    if (body.traccarDeviceId !== undefined && body.traccarDeviceId !== null) settings.traccarDeviceId = parseInt(body.traccarDeviceId)
    if (body.traccarDeviceName !== undefined) settings.traccarDeviceName = body.traccarDeviceName

    // Google Maps
    if (body.googleMapsApiKey !== undefined) settings.googleMapsApiKey = body.googleMapsApiKey
    if (body.googleMapsMapId !== undefined) settings.googleMapsMapId = body.googleMapsMapId

    // WordPress
    if (body.wordpressUrl !== undefined) settings.wordpressUrl = body.wordpressUrl
    if (body.wordpressUser !== undefined) settings.wordpressUser = body.wordpressUser
    if (body.wordpressAppPassword !== undefined) settings.wordpressAppPassword = body.wordpressAppPassword
    if (body.wordpressCacheDuration !== undefined && body.wordpressCacheDuration !== null) settings.wordpressCacheDuration = parseInt(body.wordpressCacheDuration)

    // Application
    if (body.vueTraccarPassword !== undefined) settings.vueTraccarPassword = body.vueTraccarPassword
    if (body.settingsPassword !== undefined) settings.settingsPassword = body.settingsPassword
    if (body.homeMode !== undefined) settings.homeMode = body.homeMode
    if (body.homeLatitude !== undefined) settings.homeLatitude = body.homeLatitude
    if (body.homeLongitude !== undefined) settings.homeLongitude = body.homeLongitude

    // Home Geofence
    if (body.homeGeofenceId !== undefined && body.homeGeofenceId !== null) settings.homeGeofenceId = parseInt(body.homeGeofenceId)
    if (body.homeGeofenceName !== undefined) settings.homeGeofenceName = body.homeGeofenceName

    // Route Analysis
    if (body.eventMinGap !== undefined && body.eventMinGap !== null) settings.eventMinGap = parseInt(body.eventMinGap)
    if (body.maxDays !== undefined && body.maxDays !== null) settings.maxDays = parseInt(body.maxDays)
    if (body.minDays !== undefined && body.minDays !== null) settings.minDays = parseInt(body.minDays)
    if (body.standPeriod !== undefined && body.standPeriod !== null) settings.standPeriod = parseInt(body.standPeriod)
    if (body.startDate !== undefined) settings.startDate = body.startDate

    // Side Trip Tracking
    if (body.sideTripEnabled !== undefined) settings.sideTripEnabled = body.sideTripEnabled
    if (body.sideTripDevices !== undefined) settings.sideTripDevices = body.sideTripDevices
    if (body.sideTripBufferHours !== undefined && body.sideTripBufferHours !== null) settings.sideTripBufferHours = parseInt(body.sideTripBufferHours)

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
