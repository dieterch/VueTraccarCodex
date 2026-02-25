import { ref } from 'vue'
import type { MapCenter, MapMarker, DevicePolyline, Travel } from '~/types/traccar'
import { useTraccar } from './useTraccar'
import { useTravelCache } from './useTravelCache'

export const useMapData = () => {
  const { traccarPayload, selectedTravels, device } = useTraccar()
  const {
    buildTravelCacheKey,
    getTravelSnapshot,
    saveTravelSnapshot,
    markCachedDataUsed,
    markNetworkDataUsed
  } = useTravelCache()

  // Map state
  const polygone = useState<Array<{ lat: number; lng: number }>>('polygone', () => [])
  const polylines = useState<DevicePolyline[]>('polylines', () => [])
  const sideTripPolylines = useState<DevicePolyline[]>('sideTripPolylines', () => [])
  const center = useState<MapCenter>('center', () => ({ lat: 0, lng: 0 }))
  const zoom = useState<number>('zoom', () => 10)
  const distance = useState<number>('distance', () => 0)
  const locations = useState<MapMarker[]>('locations', () => [])

  // UI toggles
  const togglemap = useState<boolean>('togglemap', () => true)
  const togglemarkers = useState<boolean>('togglemarkers', () => true)
  const togglepath = useState<boolean>('togglepath', () => true)
  const toggletravels = useState<boolean>('toggletravels', () => false)
  const toggleroute = useState<boolean>('toggleroute', () => false)
  const toggleEvents = useState<boolean>('toggleEvents', () => false)

  // POI mode
  const poiMode = useState<boolean>('poiMode', () => false)
  const manualPOIs = useState<any[]>('manualPOIs', () => [])

  // Settings dialog
  const settingsdialog = useState<boolean>('settingsdialog', () => false)

  // Config dialog
  const configdialog = useState<boolean>('configdialog', () => false)

  // About dialog
  const aboutdialog = useState<boolean>('aboutdialog', () => false)

  // Manual travel editor dialog
  const manualtraveldialog = useState<boolean>('manualtraveldialog', () => false)

  // Loading state
  const isLoading = useState<boolean>('mapLoading', () => false)
  const loadingMessage = useState<string>('mapLoadingMessage', () => 'Loading...')

  // Load manual POIs
  const loadManualPOIs = async () => {
    try {
      const payload = traccarPayload()
      const response = await $fetch('/api/manual-pois', {
        query: {
          deviceId: payload.deviceId,
          from: payload.from,
          to: payload.to
        }
      })
      if (response.success) {
        manualPOIs.value = response.pois
      }
    } catch (error) {
      console.error('Error loading manual POIs:', error)
    }
  }

  // Render map
  const renderMap = async () => {
    return renderMapForTravels(selectedTravels.value)
  }

  const renderMapForTravels = async (requestedTravels: Travel[] = []) => {
    try {
      isLoading.value = true
      loadingMessage.value = 'Loading map data...'

      // Clear side trips when rendering new map
      sideTripPolylines.value = []

      const activeTravels = requestedTravels.length > 0
        ? requestedTravels
        : selectedTravels.value

      if (activeTravels.length === 0) {
        const payload = traccarPayload()
        const result = await loadSingleTravelData(payload, null, 0)
        applySingleResult(result.data, result.pois)
        return result.data
      }

      const results = await Promise.all(activeTravels.map((item, index) => {
        const payload = buildPayloadFromTravel(item)
        return loadSingleTravelData(payload, item, index)
      }))

      const hadCachedResult = results.some(result => result.fromCache)
      if (hadCachedResult) {
        const newestCache = results
          .filter(result => Boolean(result.cachedAt))
          .map(result => result.cachedAt as string)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
        markCachedDataUsed(newestCache)
      } else {
        markNetworkDataUsed()
      }

      const mergedPolylines = results.flatMap(result => result.data.polylines || [])
      const mergedLocations = dedupeLocations(results.flatMap(result => result.data.locations || []))
      const mergedPOIs = results.flatMap(result => result.pois || [])
      const poiMarkers = mergedPOIs.map((poi: any) => ({
        key: poi.poi_key,
        lat: poi.latitude,
        lng: poi.longitude,
        title: poi.country,
        von: poi.timestamp,
        bis: poi.timestamp,
        period: 0,
        country: poi.country,
        address: poi.address,
        isPOI: true,
        poiId: poi.id
      }))

      manualPOIs.value = mergedPOIs
      polylines.value = mergedPolylines
      locations.value = [...mergedLocations, ...poiMarkers]
      distance.value = results.reduce((sum, result) => sum + (Number(result.data?.distance) || 0), 0)

      const allPoints = mergedPolylines.flatMap((line: DevicePolyline) => line.path || [])
      if (allPoints.length > 0) {
        polygone.value = allPoints.map(point => ({ lat: point.lat, lng: point.lng }))
        const bounds = computeBounds(allPoints)
        center.value = {
          lat: (bounds.minLat + bounds.maxLat) / 2,
          lng: (bounds.minLng + bounds.maxLng) / 2
        }
      } else {
        polygone.value = []
      }

      if (results.length > 0) {
        zoom.value = Math.min(...results.map(result => result.data.zoom || 10))
      }

      console.log('Map rendered:', {
        polygone: polygone.value.length,
        polylines: polylines.value.length,
        zoom: zoom.value,
        center: center.value,
        distance: distance.value,
        markers: locations.value.length
      })

      // Log polyline summary
      if (polylines.value.length > 1) {
        console.log('📊 Routes loaded:')
        polylines.value.forEach(p => {
          console.log(`  - ${p.deviceName}: ${p.path.length} points (${p.color})`)
        })
      }

      return {
        polylines: polylines.value,
        locations: locations.value,
        distance: distance.value,
        center: center.value,
        zoom: zoom.value
      }
    } catch (error) {
      console.error('Error rendering map:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const buildPayloadFromTravel = (item: Travel) => {
    const fallbackPayload = traccarPayload(item)
    return {
      ...fallbackPayload,
      name: item.title || fallbackPayload.name,
      deviceId: item.deviceId || device.value.id || fallbackPayload.deviceId,
      from: item.von || fallbackPayload.from,
      to: item.bis || fallbackPayload.to,
      travelId: item.id,
      travelSource: item.source
    }
  }

  const palette = ['#E53935', '#1E88E5', '#43A047', '#F4511E', '#8E24AA', '#00897B', '#3949AB', '#6D4C41', '#5E35B1', '#039BE5']

  const loadSingleTravelData = async (payload: any, item: Travel | null, index: number) => {
    const cacheKey = buildTravelCacheKey({
      deviceId: payload.deviceId,
      from: payload.from,
      to: payload.to,
      travelId: payload.travelId,
      travelSource: payload.travelSource
    })

    let data: any = null
    let pois: any[] = []
    let fromCache = false
    let cachedAt: string | null = null
    try {
      const plotData = await $fetch('/api/plotmaps', {
        method: 'POST',
        body: payload
      })
      let poiResponse: any = null
      try {
        poiResponse = await $fetch<any>('/api/manual-pois', {
          query: {
            deviceId: payload.deviceId,
            from: payload.from,
            to: payload.to
          }
        })
      } catch (poiError) {
        console.warn('Manual POI fetch failed, continuing without POIs:', poiError)
      }
      data = plotData
      pois = poiResponse?.success ? (poiResponse.pois || []) : []

      await saveTravelSnapshot(cacheKey, {
        plotmaps: data,
        manualPois: pois
      })
    } catch (networkError) {
      const snapshot = await getTravelSnapshot(cacheKey)
      if (!snapshot?.payload?.plotmaps) {
        throw networkError
      }
      data = snapshot.payload.plotmaps
      pois = snapshot.payload.manualPois || []
      fromCache = true
      cachedAt = snapshot.savedAt
      console.warn('Using cached travel snapshot for map rendering:', cacheKey)
    }

    const color = palette[index % palette.length]
    data.polylines = (data.polylines || []).map((line: DevicePolyline, lineIndex: number) => ({
      ...line,
      color: requestedTravelsColor(item, line.color, color),
      deviceName: item?.title || line.deviceName,
      routeKey: item?.id
        ? `${item.source || 'auto'}:${item.id}:${lineIndex}`
        : `${payload.deviceId}:${payload.from}:${payload.to}:${lineIndex}`
    }))

    return { data, pois, fromCache, cachedAt }
  }

  const requestedTravelsColor = (item: Travel | null, existingColor: string, fallbackColor: string) => {
    if (!item) return existingColor
    return fallbackColor
  }

  const dedupeLocations = (markers: MapMarker[]) => {
    const seen = new Set<string>()
    const output: MapMarker[] = []
    for (const marker of markers) {
      const key = `${marker.key}|${marker.von}|${marker.bis}|${marker.lat}|${marker.lng}`
      if (seen.has(key)) continue
      seen.add(key)
      output.push(marker)
    }
    return output
  }

  const computeBounds = (points: Array<{ lat: number; lng: number }>) => {
    const lats = points.map(point => point.lat)
    const lngs = points.map(point => point.lng)
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    }
  }

  const applySingleResult = (data: any, pois: any[]) => {
    const poiMarkers = pois.map((poi: any) => ({
      key: poi.poi_key,
      lat: poi.latitude,
      lng: poi.longitude,
      title: poi.country,
      von: poi.timestamp,
      bis: poi.timestamp,
      period: 0,
      country: poi.country,
      address: poi.address,
      isPOI: true,
      poiId: poi.id
    }))
    manualPOIs.value = pois
    polygone.value = data.polygone
    polylines.value = data.polylines || []
    zoom.value = data.zoom
    center.value = data.center
    distance.value = data.distance
    locations.value = [...data.locations, ...poiMarkers]
  }

  // Fetch side trips for a specific standstill
  const fetchSideTrips = async (from: string, to: string, deviceIds: number[]) => {
    try {
      console.log('🚴 Fetching side trips:', { from, to, deviceIds })

      const response = await $fetch('/api/side-trips', {
        method: 'POST',
        body: { from, to, deviceIds }
      })

      if (response.success && response.polylines) {
        // Add new side trip polylines to existing ones
        sideTripPolylines.value = [...sideTripPolylines.value, ...response.polylines]
        console.log(`✅ Added ${response.polylines.length} side trip polylines to map`)
        console.log(`   Total side trip polylines now: ${sideTripPolylines.value.length}`)

        // Log first few coordinates to verify location
        if (response.polylines.length > 0 && response.polylines[0].path.length > 0) {
          const firstPath = response.polylines[0].path
          console.log(`   First coordinate: lat=${firstPath[0].lat}, lng=${firstPath[0].lng}`)
          console.log(`   Last coordinate: lat=${firstPath[firstPath.length-1].lat}, lng=${firstPath[firstPath.length-1].lng}`)
        }
      }

      return response
    } catch (error) {
      console.error('Error fetching side trips:', error)
      throw error
    }
  }

  // Clear side trip polylines
  const clearSideTrips = () => {
    sideTripPolylines.value = []
  }

  return {
    // State
    polygone,
    polylines,
    sideTripPolylines,
    center,
    zoom,
    distance,
    locations,

    // UI Toggles
    togglemap,
    togglemarkers,
    togglepath,
    toggletravels,
    toggleroute,
    toggleEvents,
    settingsdialog,
    configdialog,
    aboutdialog,
    manualtraveldialog,

    // POI Mode
    poiMode,
    manualPOIs,

    // Loading
    isLoading,
    loadingMessage,

    // Methods
    renderMap,
    renderMapForTravels,
    fetchSideTrips,
    clearSideTrips,
    loadManualPOIs
  }
}
