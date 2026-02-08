import { createTraccarClient } from '../utils/traccar-client'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import type { DevicePolyline } from '~/types/traccar'

/**
 * Convert date to ISO 8601 format with timezone (Traccar requires this)
 * Input: "2023-05-22 12:03" or "2023-05-22T12:03:00Z"
 * Output: "2023-05-22T12:03:00Z"
 */
function toISO8601(dateStr: string): string {
  // If already in ISO format with Z, return as is
  if (dateStr.includes('Z')) {
    return dateStr
  }

  // Replace space with T if needed
  const normalized = dateStr.replace(' ', 'T')

  // Add seconds if missing
  const withSeconds = normalized.includes(':00') ? normalized : normalized + ':00'

  // Add Z timezone if missing
  return withSeconds.endsWith('Z') ? withSeconds : withSeconds + 'Z'
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { from, to, deviceIds } = body

    console.log('🚴 /api/side-trips called:')
    console.log(`   From: ${from}`)
    console.log(`   To: ${to}`)
    console.log(`   Device IDs:`, deviceIds)

    if (!from || !to || !deviceIds || deviceIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: from, to, deviceIds'
      })
    }

    // Convert dates to ISO 8601 format
    const fromISO = toISO8601(from)
    const toISO = toISO8601(to)

    console.log(`   Converted: ${fromISO} to ${toISO}`)

    const traccarClient = createTraccarClient()
    const polylines: DevicePolyline[] = []

    // Fetch all devices in parallel
    const fetchPromises = deviceIds.map(async (deviceId: number) => {
      try {
        console.log(`⏳ Fetching side trip for device ${deviceId} (${fromISO} to ${toISO})`)

        // Fetch route data directly from Traccar API (bypass cache)
        const positions = await traccarClient.getRoute(deviceId, fromISO, toISO)

        if (positions.length === 0) {
          console.log(`ℹ️  No positions found for device ${deviceId}`)
          return null
        }

        console.log(`✅ Device ${deviceId}: ${positions.length} positions`)

        // Get device info
        let deviceName = `Device ${deviceId}`
        let deviceColor = '#0088FF'
        let deviceLineWeight = 2

        try {
          const devices = await traccarClient.getDevices()
          const device = devices.find(d => d.id === deviceId)
          if (device) {
            deviceName = device.name
          }

          // Load device settings for color/weight without requiring admin-only /api/settings
          const yamlPath = join(process.cwd(), 'data', 'settings.yml')
          const content = await readFile(yamlPath, 'utf-8')
          const settings = parseYaml(content) || {}
          if (Array.isArray(settings.sideTripDevices)) {
            const deviceConfig = settings.sideTripDevices.find(
              (d: any) => d.deviceId === deviceId
            )
            if (deviceConfig) {
              deviceColor = deviceConfig.color || deviceColor
              deviceLineWeight = deviceConfig.lineWeight || deviceLineWeight
            }
          }
        } catch (error: any) {
          if (error?.code !== 'ENOENT') {
            console.error('Error fetching device info:', error)
          }
        }

        // Create polyline path directly from Traccar positions
        const path = positions.map(p => ({
          lat: p.latitude,
          lng: p.longitude
        }))

        return {
          deviceId,
          deviceName,
          color: deviceColor,
          lineWeight: deviceLineWeight,
          path,
          isMainDevice: false
        } as DevicePolyline
      } catch (error: any) {
        if (error.statusCode === 400) {
          console.warn(`⚠️  Device ${deviceId}: No data available for this time period`)
        } else if (error.statusCode === 404) {
          console.warn(`⚠️  Device ${deviceId}: Device not found`)
        } else {
          console.error(`❌ Error fetching side trip for device ${deviceId}:`, error.message || error)
        }
        return null
      }
    })

    const results = await Promise.all(fetchPromises)

    // Filter out null results
    for (const result of results) {
      if (result !== null) {
        polylines.push(result)
      }
    }

    console.log(`✅ Side trips: ${polylines.length}/${deviceIds.length} devices loaded`)

    return {
      success: true,
      polylines
    }
  } catch (error: any) {
    console.error('Error in /api/side-trips:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch side trips'
    })
  }
})
