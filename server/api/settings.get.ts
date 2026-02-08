import { readFile, writeFile } from 'fs/promises'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const buildSettings = (data: any) => ({
    // Traccar API
    traccarUrl: data.traccarUrl ?? config.traccarUrl,
    traccarUser: data.traccarUser ?? config.traccarUser,
    traccarPassword: data.traccarPassword ?? config.traccarPassword,
    traccarDeviceId: data.traccarDeviceId ?? config.traccarDeviceId,
    traccarDeviceName: data.traccarDeviceName ?? config.traccarDeviceName,

    // Google Maps
    googleMapsApiKey: data.googleMapsApiKey ?? config.public.googleMapsApiKey,
    googleMapsMapId: data.googleMapsMapId ?? config.public.googleMapsMapId,

    // WordPress
    wordpressUrl: data.wordpressUrl ?? config.wordpressUrl,
    wordpressUser: data.wordpressUser ?? config.wordpressUser,
    wordpressAppPassword: data.wordpressAppPassword ?? config.wordpressAppPassword,
    wordpressCacheDuration: data.wordpressCacheDuration ?? config.wordpressCacheDuration,

    // Application
    vueTraccarPassword: data.vueTraccarPassword ?? config.vueTraccarPassword,
    settingsPassword: data.settingsPassword ?? config.settingsPassword,
    homeMode: data.homeMode !== undefined ? data.homeMode : config.homeMode,
    homeLatitude: data.homeLatitude ?? config.homeLatitude,
    homeLongitude: data.homeLongitude ?? config.homeLongitude,

    // Home Geofence
    homeGeofenceId: data.homeGeofenceId ?? config.homeGeofenceId,
    homeGeofenceName: data.homeGeofenceName ?? config.homeGeofenceName,

    // Route Analysis
    eventMinGap: data.eventMinGap ?? config.eventMinGap,
    maxDays: data.maxDays ?? config.maxDays,
    minDays: data.minDays ?? config.minDays,
    standPeriod: data.standPeriod ?? config.standPeriod,
    startDate: data.startDate ?? config.startDate,

    // Side Trip Tracking
    sideTripEnabled: data.sideTripEnabled !== undefined ? data.sideTripEnabled : false,
    sideTripDevices: data.sideTripDevices ?? [],
    sideTripBufferHours: data.sideTripBufferHours !== undefined ? data.sideTripBufferHours : 6,
  })

  try {
    const yamlPath = join(process.cwd(), 'data', 'settings.yml')
    const content = await readFile(yamlPath, 'utf-8')
    const data = parseYaml(content) || {}

    return {
      success: true,
      settings: buildSettings(data)
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const settings = buildSettings({})
      const yamlPath = join(process.cwd(), 'data', 'settings.yml')
      await writeFile(yamlPath, stringifyYaml(settings), 'utf-8')

      return {
        success: true,
        settings
      }
    }

    console.error('Error loading settings:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to load settings'
    })
  }
})
