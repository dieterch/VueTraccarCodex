import { ref } from 'vue'
import type { MapCenter, MapMarker, DevicePolyline } from '~/types/traccar'
import { useTraccar } from './useTraccar'
import { useTravelCache } from './useTravelCache'

export const useMapData = () => {
  const { traccarPayload } = useTraccar()
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
    try {
      isLoading.value = true
      loadingMessage.value = 'Loading map data...'

      // Clear side trips when rendering new map
      sideTripPolylines.value = []

      const payload = traccarPayload()
      const cacheKey = buildTravelCacheKey({
        deviceId: payload.deviceId,
        from: payload.from,
        to: payload.to,
        travelId: payload.travelId,
        travelSource: payload.travelSource
      })

      let data: any = null
      let pois: any[] = []
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
        manualPOIs.value = pois

        await saveTravelSnapshot(cacheKey, {
          plotmaps: data,
          manualPois: pois
        })
        markNetworkDataUsed()
      } catch (networkError) {
        const snapshot = await getTravelSnapshot(cacheKey)
        if (!snapshot?.payload?.plotmaps) {
          throw networkError
        }
        data = snapshot.payload.plotmaps
        pois = snapshot.payload.manualPois || []
        manualPOIs.value = pois
        markCachedDataUsed(snapshot.savedAt)
        console.warn('Using cached travel snapshot for map rendering:', cacheKey)
      }

      // Convert POIs to markers
      const poiMarkers = manualPOIs.value.map(poi => ({
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

      polygone.value = data.polygone
      polylines.value = data.polylines || []
      zoom.value = data.zoom
      center.value = data.center
      distance.value = data.distance
      locations.value = [...data.locations, ...poiMarkers]

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

      return data
    } catch (error) {
      console.error('Error rendering map:', error)
      throw error
    } finally {
      isLoading.value = false
    }
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
    fetchSideTrips,
    clearSideTrips,
    loadManualPOIs
  }
}
