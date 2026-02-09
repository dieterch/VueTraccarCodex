import { createTraccarService } from '../services/traccar.service'
import {
  calculateBounds,
  calculateCenter,
  calculateZoom,
  filterStandstillPeriods,
  cleanStandstillPeriods,
  translateCountry,
  calculateDistance
} from '../services/route-analyzer'
import { getManualTravel, getManualTravelPositions } from '../utils/app-db'
import type { PlotMapsResponse, MapMarker, DevicePolyline } from '~/types/traccar'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { deviceId, from, to, travelSource, travelId } = body

    console.log('🔍 /api/plotmaps called with:')
    console.log(`   Device ID: ${deviceId}`)
    console.log(`   From: ${from}`)
    console.log(`   To: ${to}`)

    if (!deviceId || !from || !to) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: deviceId, from, to'
      })
    }

    const traccarService = createTraccarService()

    const isManual = travelSource === 'manual' && travelId

    // Get main device route data
    const route = isManual
      ? buildManualRoute(travelId)
      : await traccarService.getRouteData(deviceId, from, to)

    if (route.length === 0) {
      return {
        bounds: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
        center: { lat: 0, lng: 0 },
        zoom: 10,
        distance: 0,
        polygone: [],
        polylines: [],
        locations: []
      }
    }

    // Calculate bounds, center, and zoom
    const bounds = calculateBounds(route)
    const center = calculateCenter(bounds)
    const zoom = calculateZoom(bounds)

    // Calculate trip distance (end - start)
    const distance = route[route.length - 1].totalDistance - route[0].totalDistance

    // Create main polyline (array of lat/lng with timestamps)
    const polygone = route.map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      timestamp: p.fixTime
    }))

    let locations: MapMarker[] = []
    if (!isManual) {
      // Get standstill periods for main device
      let standstills = await traccarService.getStandstillPeriods(deviceId)

      // Filter by time range
      standstills = filterStandstillPeriods(standstills, from, to)

      // Clean/merge nearby standstills
      standstills = cleanStandstillPeriods(standstills)

      // Convert to markers
      locations = standstills.map(s => ({
        key: s.key,
        lat: s.latitude,
        lng: s.longitude,
        title: translateCountry(s.country),
        von: s.von,
        bis: s.bis,
        period: s.period,
        country: translateCountry(s.country),
        address: s.address
      }))
    }

    // Get main device name
    let mainDeviceName = 'Main Device'
    try {
      const devices = await traccarService.getDevices()
      const mainDeviceId = isManual && route.length > 0
        ? route[0].deviceId
        : deviceId
      const mainDevice = devices.find(d => d.id === mainDeviceId)
      if (mainDevice) {
        mainDeviceName = mainDevice.name
      }
    } catch (error) {
      console.error('Error fetching device name:', error)
    }

    // Create polylines array with only main device route
    const polylines: DevicePolyline[] = [{
      deviceId: route[0]?.deviceId || deviceId,
      deviceName: mainDeviceName,
      color: '#FF0000', // Red for main device
      lineWeight: 2,
      path: polygone,
      isMainDevice: true
    }]

    const response: PlotMapsResponse = {
      bounds,
      center,
      zoom,
      distance,
      polygone, // Keep for backward compatibility
      polylines,
      locations
    }

    return response
  } catch (error: any) {
    console.error('Error in /api/plotmaps:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to generate plot data'
    })
  }
})

function buildManualRoute(travelId: string) {
  const manualTravel = getManualTravel(travelId)
  if (!manualTravel) return []

  const positions = getManualTravelPositions(travelId)
  if (positions.length === 0) return []

  let totalDistance = 0
  const route = positions.map((pos: any, index: number) => {
    if (index > 0) {
      totalDistance += calculateDistance(
        { latitude: positions[index - 1].latitude, longitude: positions[index - 1].longitude },
        { latitude: pos.latitude, longitude: pos.longitude }
      )
    }

    return {
      id: pos.id,
      deviceId: manualTravel.source_device_id,
      fixTime: pos.fix_time,
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitude: pos.altitude || 0,
      speed: pos.speed || 0,
      totalDistance,
      attributes: pos.attributes ? safeParseJson(pos.attributes) : {}
    }
  })

  return route
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}
