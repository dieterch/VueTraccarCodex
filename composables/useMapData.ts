import type { MapCenter, MapMarker, DevicePolyline, Travel } from '~/types/traccar'
import { useTraccar } from './useTraccar'
import { useTravelCache } from './useTravelCache'

const LIVE_DEFAULT_POLLING_INTERVAL_MS = 30000
const LIVE_MIN_POLLING_INTERVAL_MS = 5000
const LIVE_MAX_PATH_POINTS = 120000
const LIVE_MODE_STORAGE_KEY = 'liveModeEnabled'
const LIVE_POLLING_STORAGE_KEY = 'livePollingIntervalMs'

let livePollTimer: ReturnType<typeof setTimeout> | null = null

export const useMapData = () => {
  const { traccarPayload, selectedTravels, device } = useTraccar()
  const {
    buildTravelCacheKey,
    buildLiveRouteCacheKey,
    getTravelSnapshot,
    getLiveRoutePoints,
    appendLiveRoutePoints,
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

  // Live mode state
  const liveMode = useState<boolean>('liveMode', () => false)
  const livePollingIntervalMs = useState<number>('livePollingIntervalMs', () => LIVE_DEFAULT_POLLING_INTERVAL_MS)
  const livePollingInFlight = useState<boolean>('livePollingInFlight', () => false)
  const liveLastFetchByRouteKey = useState<Record<string, string>>('liveLastFetchByRouteKey', () => ({}))
  const liveConfigLoaded = useState<boolean>('liveConfigLoaded', () => false)

  if (process.client && !liveConfigLoaded.value) {
    const savedLiveMode = window.localStorage.getItem(LIVE_MODE_STORAGE_KEY)
    const savedInterval = Number(window.localStorage.getItem(LIVE_POLLING_STORAGE_KEY) || LIVE_DEFAULT_POLLING_INTERVAL_MS)
    liveMode.value = savedLiveMode === 'true'
    livePollingIntervalMs.value = normalizeLivePollingInterval(savedInterval)
    liveConfigLoaded.value = true
  }

  function normalizeLivePollingInterval(value: number) {
    if (!Number.isFinite(value)) return LIVE_DEFAULT_POLLING_INTERVAL_MS
    return Math.max(LIVE_MIN_POLLING_INTERVAL_MS, Math.floor(value))
  }

  const persistLiveSettings = () => {
    if (!process.client) return
    window.localStorage.setItem(LIVE_MODE_STORAGE_KEY, String(liveMode.value))
    window.localStorage.setItem(LIVE_POLLING_STORAGE_KEY, String(livePollingIntervalMs.value))
  }

  const clearLiveTimer = () => {
    if (livePollTimer) {
      clearTimeout(livePollTimer)
      livePollTimer = null
    }
  }

  const scheduleLivePoll = () => {
    if (!process.client || !liveMode.value) return
    clearLiveTimer()
    livePollTimer = setTimeout(() => {
      pollLiveUpdates().catch((error) => {
        console.error('Live polling failed:', error)
      })
    }, livePollingIntervalMs.value)
  }

  const getLastTimestamp = (path: Array<{ timestamp?: string }> = []) => {
    for (let i = path.length - 1; i >= 0; i--) {
      const timestamp = path[i]?.timestamp
      if (typeof timestamp === 'string' && timestamp) return timestamp
    }
    return null
  }

  const toIsoAfter = (timestamp: string | null) => {
    if (!timestamp) return null
    const base = new Date(timestamp)
    if (Number.isNaN(base.getTime())) return null
    return new Date(base.getTime() + 1).toISOString()
  }

  const getTravelDescriptor = (item: Travel) => {
    const payload = buildPayloadFromTravel(item)
    const source = item.source || 'auto'
    const routePrefix = item.id
      ? `${source}:${item.id}:`
      : `${payload.deviceId}:${payload.from}:${payload.to}:`
    const liveKey = buildLiveRouteCacheKey({
      deviceId: payload.deviceId,
      travelId: item.id || `${payload.from}:${payload.to}`,
      travelSource: source
    })
    return {
      payload,
      routePrefix,
      routeStateKey: `${payload.deviceId}:${routePrefix}`,
      liveKey
    }
  }

  const findPolylineIndex = (routePrefix: string, deviceId: number) => {
    const byRouteKey = polylines.value.findIndex((line: any) =>
      typeof line.routeKey === 'string' &&
      line.routeKey.startsWith(routePrefix)
    )
    if (byRouteKey >= 0) return byRouteKey
    return polylines.value.findIndex((line) => line.deviceId === deviceId && line.isMainDevice)
  }

  const toLivePoints = (items: any[]) => {
    return items
      .filter((pos) => (
        pos &&
        typeof pos.latitude === 'number' &&
        typeof pos.longitude === 'number' &&
        typeof pos.fixTime === 'string'
      ))
      .map((pos) => ({
        lat: pos.latitude,
        lng: pos.longitude,
        timestamp: pos.fixTime
      }))
  }

  const refreshPolygonFromPolylines = () => {
    const allPoints = polylines.value.flatMap((line: DevicePolyline) => line.path || [])
    polygone.value = allPoints.map((point) => ({ lat: point.lat, lng: point.lng }))
  }

  const calculateDistanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const earthRadiusKm = 6371
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    return earthRadiusKm * c
  }

  const appendPointsToPolyline = (polylineIndex: number, nextPoints: Array<{ lat: number; lng: number; timestamp: string }>) => {
    const line = polylines.value[polylineIndex]
    if (!line || nextPoints.length === 0) return 0

    const existingPath = line.path || []
    const lastTimestamp = getLastTimestamp(existingPath)
    const filtered = lastTimestamp
      ? nextPoints.filter((point) => point.timestamp > lastTimestamp)
      : nextPoints

    if (filtered.length === 0) return 0

    const mergedPath = [...existingPath, ...filtered]
    const boundedPath = mergedPath.length > LIVE_MAX_PATH_POINTS
      ? mergedPath.slice(mergedPath.length - LIVE_MAX_PATH_POINTS)
      : mergedPath

    let incrementKm = 0
    const distancePath = existingPath.length > 0
      ? [existingPath[existingPath.length - 1], ...filtered]
      : filtered
    for (let i = 0; i < distancePath.length - 1; i++) {
      incrementKm += calculateDistanceKm(distancePath[i], distancePath[i + 1])
    }

    polylines.value[polylineIndex] = {
      ...line,
      path: boundedPath
    }

    refreshPolygonFromPolylines()
    distance.value += incrementKm

    return filtered.length
  }

  const initializeLiveFromCurrentMap = async () => {
    const active = selectedTravels.value.filter((item) => (item.source || 'auto') === 'auto')
    for (const item of active) {
      const descriptor = getTravelDescriptor(item)
      const polylineIndex = findPolylineIndex(descriptor.routePrefix, descriptor.payload.deviceId)
      if (polylineIndex < 0) continue

      const line = polylines.value[polylineIndex]
      const liveCachePoints = await getLiveRoutePoints(descriptor.liveKey)
      const appendedCount = appendPointsToPolyline(polylineIndex, liveCachePoints)

      const lastFromPath = getLastTimestamp(polylines.value[polylineIndex]?.path || line.path || [])
      const lastFromCache = liveCachePoints.length > 0
        ? liveCachePoints[liveCachePoints.length - 1].timestamp
        : null
      const finalLast = (lastFromCache && (!lastFromPath || lastFromCache > lastFromPath))
        ? lastFromCache
        : lastFromPath

      if (finalLast) {
        liveLastFetchByRouteKey.value = {
          ...liveLastFetchByRouteKey.value,
          [descriptor.routeStateKey]: finalLast
        }
      }

      if (appendedCount > 0) {
        console.log(`Live cache restored ${appendedCount} points for ${descriptor.routeStateKey}`)
      }
    }
  }

  const pollLiveUpdates = async () => {
    if (!process.client || !liveMode.value || livePollingInFlight.value) {
      scheduleLivePoll()
      return
    }

    livePollingInFlight.value = true
    try {
      const active = selectedTravels.value.filter((item) => (item.source || 'auto') === 'auto')
      for (const item of active) {
        const descriptor = getTravelDescriptor(item)
        const polylineIndex = findPolylineIndex(descriptor.routePrefix, descriptor.payload.deviceId)
        if (polylineIndex < 0) continue

        const existingLast = getLastTimestamp(polylines.value[polylineIndex]?.path || [])
        const knownLast = liveLastFetchByRouteKey.value[descriptor.routeStateKey] || existingLast
        const from = toIsoAfter(knownLast)
        const to = new Date().toISOString()
        if (!from || from >= to) continue

        const response = await $fetch<any[]>('/api/route', {
          method: 'POST',
          body: {
            deviceId: descriptor.payload.deviceId,
            from,
            to,
            direct: true
          }
        })

        const fresh = toLivePoints(response).filter((point) => !knownLast || point.timestamp > knownLast)
        if (fresh.length === 0) continue

        const appendedCount = appendPointsToPolyline(polylineIndex, fresh)
        if (appendedCount > 0) {
          await appendLiveRoutePoints(descriptor.liveKey, fresh)
          liveLastFetchByRouteKey.value = {
            ...liveLastFetchByRouteKey.value,
            [descriptor.routeStateKey]: fresh[fresh.length - 1].timestamp
          }
          console.log(`Live update appended ${appendedCount} points for ${descriptor.routeStateKey}`)
        }
      }
    } catch (error) {
      console.error('Error polling live updates:', error)
    } finally {
      livePollingInFlight.value = false
      scheduleLivePoll()
    }
  }

  const setLivePollingInterval = (ms: number) => {
    livePollingIntervalMs.value = normalizeLivePollingInterval(ms)
    persistLiveSettings()
    if (liveMode.value) {
      scheduleLivePoll()
    }
  }

  const setLiveModeEnabled = async (enabled: boolean) => {
    liveMode.value = enabled
    persistLiveSettings()

    if (!enabled) {
      clearLiveTimer()
      return
    }

    await initializeLiveFromCurrentMap()
    await pollLiveUpdates()
  }

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

      if (liveMode.value) {
        await initializeLiveFromCurrentMap()
        scheduleLivePoll()
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
    liveMode,
    livePollingIntervalMs,
    livePollingInFlight,

    // Loading
    isLoading,
    loadingMessage,

    // Methods
    renderMap,
    renderMapForTravels,
    pollLiveUpdates,
    setLiveModeEnabled,
    setLivePollingInterval,
    fetchSideTrips,
    clearSideTrips,
    loadManualPOIs
  }
}
