// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync, existsSync } from 'fs'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'

// Load settings.yml to override .env values
try {
  const settingsPath = join(process.cwd(), 'data', 'settings.yml')
  if (existsSync(settingsPath)) {
    const content = readFileSync(settingsPath, 'utf-8')
    const settings = parseYaml(content) || {}

    // Map settings to env vars
    const envMapping: Record<string, string> = {
      traccarUrl: 'TRACCAR_URL',
      traccarUser: 'TRACCAR_USER',
      traccarPassword: 'TRACCAR_PASSWORD',
      traccarDeviceId: 'TRACCAR_DEVICE_ID',
      traccarDeviceName: 'TRACCAR_DEVICE_NAME',
      googleMapsApiKey: 'NUXT_PUBLIC_GOOGLE_MAPS_API_KEY',
      googleMapsMapId: 'NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID',
      wordpressUrl: 'WORDPRESS_URL',
      wordpressUser: 'WORDPRESS_USER',
      wordpressAppPassword: 'WORDPRESS_APP_PASSWORD',
      wordpressCacheDuration: 'WORDPRESS_CACHE_DURATION',
      vueTraccarPassword: 'VUE_TRACCAR_PASSWORD',
      settingsPassword: 'SETTINGS_PASSWORD',
      homeMode: 'HOME_MODE',
      homeLatitude: 'HOME_LATITUDE',
      homeLongitude: 'HOME_LONGITUDE',
      homeGeofenceId: 'HOME_GEOFENCE_ID',
      homeGeofenceName: 'HOME_GEOFENCE_NAME',
      eventMinGap: 'EVENT_MIN_GAP',
      maxDays: 'MAX_DAYS',
      minDays: 'MIN_DAYS',
      standPeriod: 'STAND_PERIOD',
      startDate: 'START_DATE'
    }

    for (const [settingKey, envKey] of Object.entries(envMapping)) {
      if (settings[settingKey] !== undefined && settings[settingKey] !== null) {
        process.env[envKey] = String(settings[settingKey])
      }
    }
    console.log('✓ Loaded settings from settings.yml')
  }
} catch (error) {
  console.error('Error loading settings.yml:', error)
}

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  devServer: {
    host: '0.0.0.0',
    port: 5999
  },

  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.css'
  ],

  build: {
    transpile: ['vuetify'],
  },

  runtimeConfig: {
    // Server-only (private)
    traccarUrl: process.env.TRACCAR_URL,
    traccarUser: process.env.TRACCAR_USER,
    traccarPassword: process.env.TRACCAR_PASSWORD,
    traccarDeviceId: process.env.TRACCAR_DEVICE_ID,
    traccarDeviceName: process.env.TRACCAR_DEVICE_NAME || 'Device',
    wordpressUrl: process.env.WORDPRESS_URL,
    wordpressUser: process.env.WORDPRESS_USER,
    wordpressAppPassword: process.env.WORDPRESS_APP_PASSWORD,
    wordpressCacheDuration: process.env.WORDPRESS_CACHE_DURATION || '3600',
    vueTraccarPassword: process.env.VUE_TRACCAR_PASSWORD,
    settingsPassword: process.env.SETTINGS_PASSWORD || 'admin',
    homeMode: process.env.HOME_MODE === 'true',
    homeLatitude: process.env.HOME_LATITUDE,
    homeLongitude: process.env.HOME_LONGITUDE,
    homeGeofenceId: parseInt(process.env.HOME_GEOFENCE_ID || '1'),
    homeGeofenceName: process.env.HOME_GEOFENCE_NAME || 'Home',
    eventMinGap: parseInt(process.env.EVENT_MIN_GAP || '60'),
    maxDays: parseInt(process.env.MAX_DAYS || '170'),
    minDays: parseInt(process.env.MIN_DAYS || '2'),
    standPeriod: parseInt(process.env.STAND_PERIOD || '12'),
    startDate: process.env.START_DATE || '2019-03-01T00:00:00Z',
    jwtSecret: process.env.JWT_SECRET || 'change-me',
    jwtIssuer: process.env.JWT_ISSUER || 'vue-traccar',
    jwtAudience: process.env.JWT_AUDIENCE || 'vue-traccar-ui',
    jwtTtlSeconds: parseInt(process.env.JWT_TTL_SECONDS || '3600'),
    authCookieName: process.env.AUTH_COOKIE_NAME || 'vt_auth',
    authCookieSecure: process.env.AUTH_COOKIE_SECURE
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    adminGroup: process.env.ADMIN_GROUP || 'admins',
    authBypass: process.env.AUTH_BYPASS === 'true',
    authBypassRole: process.env.AUTH_BYPASS_ROLE || 'admin',

    public: {
      // Client-accessible
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      googleMapsMapId: process.env.NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      autheliaLogoutUrl: process.env.NUXT_PUBLIC_AUTHELIA_LOGOUT_URL,
    },
  },
})
