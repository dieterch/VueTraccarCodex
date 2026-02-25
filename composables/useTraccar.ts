import { ref } from 'vue'
import { tracdate } from '~/utils/date'
import { getCookie, setCookie } from '~/utils/crypto'
import type { Travel, TraccarDevice, TraccarEvent } from '~/types/traccar'
import { useTravelCache } from './useTravelCache'

export const useTraccar = () => {
  const {
    buildTravelCacheKey,
    getTravelSnapshot,
    saveTravelSnapshot,
    markCachedDataUsed,
    markNetworkDataUsed
  } = useTravelCache()

  // State
  const device = useState<TraccarDevice>('device', () => ({
    id: 4,
    name: 'WMB Tk106',
    uniqueId: '',
    status: '',
    lastUpdate: '',
    positionId: 0,
    groupId: 0,
    disabled: false
  }))

  const startdate = useState<Date>('startdate', () => new Date('2019-03-01T00:00:00Z'))
  const stopdate = useState<Date>('stopdate', () => new Date())

  const travels = useState<Travel[]>('travels', () => [])
  const travel = useState<Travel | null>('travel', () => null)
  const selectedTravels = useState<Travel[]>('selectedTravels', () => [])

  const route = useState<any[]>('route', () => [])
  const events = useState<TraccarEvent[]>('events', () => [])

  // Payload builder
  const traccarPayload = (travelOverride?: Travel | null) => {
    const primaryTravel = travelOverride || selectedTravels.value[0] || travel.value
    const payload = {
      name: primaryTravel?.title || 'filename',
      deviceId: device.value.id,
      from: tracdate(startdate.value),
      to: tracdate(stopdate.value),
      maxpoints: '2500',
      travelId: primaryTravel?.id,
      travelSource: primaryTravel?.source
    }
    console.log('🔧 traccarPayload() called:')
    console.log('   startdate.value:', startdate.value)
    console.log('   stopdate.value:', stopdate.value)
    console.log('   Formatted from:', payload.from)
    console.log('   Formatted to:', payload.to)
    return payload
  }

  const getTravelSelectionKey = (item: Travel) => {
    const source = item.source || 'auto'
    const id = item.id || `${item.deviceId || ''}:${item.von}:${item.bis}`
    return `${source}:${id}`
  }

  const syncPrimaryTravel = (list: Travel[]) => {
    const primary = list[0] || null
    travel.value = primary

    if (primary?.deviceId) {
      device.value = {
        ...device.value,
        id: primary.deviceId
      }
    }

    if (primary) {
      startdate.value = new Date(primary.von)
      stopdate.value = new Date(primary.bis)
    }
  }

  const setSelectedTravels = async (items: Travel[]) => {
    const seen = new Set<string>()
    const deduped: Travel[] = []

    for (const item of items) {
      const key = getTravelSelectionKey(item)
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
    }

    const nextSelection = deduped.length > 0
      ? deduped
      : (travels.value.length > 0 ? [travels.value[travels.value.length - 1]] : [])

    selectedTravels.value = nextSelection
    syncPrimaryTravel(nextSelection)

    const keys = nextSelection.map(getTravelSelectionKey)
    setCookie('travelkeys', JSON.stringify(keys), 30)
    if (nextSelection[0]) {
      const index = travels.value.findIndex(t => getTravelSelectionKey(t) === getTravelSelectionKey(nextSelection[0]))
      setCookie('travelindex', String(index), 30)
    }

    const { renderMapForTravels } = useMapData()
    await renderMapForTravels(nextSelection)
  }

  // Get travels
  const getTravels = async () => {
    try {
      const payload = traccarPayload()
      const data = await $fetch<Travel[]>('/api/travels', {
        method: 'POST',
        body: payload
      })

      travels.value = data

      // Load saved travel selection keys from cookie
      const savedKeysRaw = getCookie('travelkeys')
      let initialSelection: Travel[] = []

      if (savedKeysRaw) {
        try {
          const savedKeys = JSON.parse(savedKeysRaw) as string[]
          const byKey = new Map(data.map(item => [getTravelSelectionKey(item), item]))
          initialSelection = savedKeys.map(key => byKey.get(key)).filter(Boolean) as Travel[]
        } catch (error) {
          console.warn('Failed to parse saved travel selection:', error)
        }
      }

      if (initialSelection.length === 0) {
        // Backward compatibility with previous single-selection cookie
        const savedIndex = getCookie('travelindex')
        if (savedIndex && data[parseInt(savedIndex)]) {
          initialSelection = [data[parseInt(savedIndex)]]
        } else if (data.length > 0) {
          initialSelection = [data[data.length - 1]]
        }
      }

      selectedTravels.value = initialSelection
      syncPrimaryTravel(initialSelection)

      // Automatically render the map after loading travels
      const { renderMapForTravels } = useMapData()
      console.log('🚀 Initial map render')
      await renderMapForTravels(selectedTravels.value)

      return data
    } catch (error) {
      console.error('Error fetching travels:', error)
      throw error
    }
  }

  // Get route
  const getRoute = async () => {
    try {
      const payload = traccarPayload()
      const cacheKey = buildTravelCacheKey({
        deviceId: payload.deviceId,
        from: payload.from,
        to: payload.to,
        travelId: payload.travelId,
        travelSource: payload.travelSource
      })
      try {
        const data = await $fetch('/api/route', {
          method: 'POST',
          body: payload
        })
        route.value = data
        await saveTravelSnapshot(cacheKey, { route: data as any[] })
        markNetworkDataUsed()
        return data
      } catch (networkError) {
        const snapshot = await getTravelSnapshot(cacheKey)
        const cachedRoute = snapshot?.payload?.route
        if (!cachedRoute) {
          throw networkError
        }
        route.value = cachedRoute
        markCachedDataUsed(snapshot.savedAt)
        console.warn('Using cached route data:', cacheKey)
        return cachedRoute
      }
    } catch (error) {
      console.error('Error fetching route:', error)
      throw error
    }
  }

  // Get events
  const getEvents = async () => {
    try {
      const payload = traccarPayload()
      const cacheKey = buildTravelCacheKey({
        deviceId: payload.deviceId,
        from: payload.from,
        to: payload.to,
        travelId: payload.travelId,
        travelSource: payload.travelSource
      })
      try {
        const data = await $fetch<TraccarEvent[]>('/api/events', {
          method: 'POST',
          body: payload
        })
        events.value = data
        await saveTravelSnapshot(cacheKey, { events: data })
        markNetworkDataUsed()
        return data
      } catch (networkError) {
        const snapshot = await getTravelSnapshot(cacheKey)
        const cachedEvents = snapshot?.payload?.events
        if (!cachedEvents) {
          throw networkError
        }
        events.value = cachedEvents
        markCachedDataUsed(snapshot.savedAt)
        console.warn('Using cached events data:', cacheKey)
        return cachedEvents
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      throw error
    }
  }

  // Download file helper
  const download = (data: string, filename: string) => {
    if (process.client) {
      const fileURL = window.URL.createObjectURL(new Blob([data]))
      const fURL = document.createElement('a')
      fURL.href = fileURL
      fURL.setAttribute('download', filename)
      document.body.appendChild(fURL)
      fURL.click()
      document.body.removeChild(fURL)
      window.URL.revokeObjectURL(fileURL)
    }
  }

  // Download KML
  const downloadKml = async () => {
    try {
      const payload = traccarPayload()
      const response = await $fetch<string>('/api/download.kml', {
        method: 'POST',
        body: payload
      })

      const filename = `${travel.value?.title || 'route'}.kml`
      download(response, filename)
    } catch (error) {
      console.error('Error downloading KML:', error)
      throw error
    }
  }

  // Prefetch route data
  const prefetchRoute = async () => {
    try {
      const response = await $fetch('/api/prefetchroute')
      console.log('Route prefetched:', response)
      return response
    } catch (error) {
      console.error('Error prefetching route:', error)
      throw error
    }
  }

  // Delete prefetch cache
  const delPrefetch = async () => {
    try {
      const response = await $fetch('/api/delprefetch')
      console.log('Cache deleted:', response)
      return response
    } catch (error) {
      console.error('Error deleting prefetch:', error)
      throw error
    }
  }

  // Delete and rebuild cache
  const rebuildCache = async () => {
    try {
      await delPrefetch()
      const response = await prefetchRoute()
      return response
    } catch (error) {
      console.error('Error rebuilding cache:', error)
      throw error
    }
  }

  // Check cache status
  const checkCacheStatus = async () => {
    try {
      const data = await $fetch('/api/cache-status')
      return data
    } catch (error) {
      console.error('Error checking cache status:', error)
      throw error
    }
  }

  // Get devices
  const getDevices = async () => {
    try {
      const data = await $fetch<{ success: boolean; devices: TraccarDevice[] }>('/api/devices')
      return data.devices
    } catch (error) {
      console.error('Error fetching devices:', error)
      throw error
    }
  }

  return {
    // State
    device,
    startdate,
    stopdate,
    travels,
    travel,
    selectedTravels,
    route,
    events,

    // Methods
    traccarPayload,
    setSelectedTravels,
    getTravels,
    getRoute,
    getEvents,
    downloadKml,
    prefetchRoute,
    delPrefetch,
    rebuildCache,
    checkCacheStatus,
    getDevices,
    download
  }
}
