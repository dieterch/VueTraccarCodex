import { ref } from 'vue'
import { tracdate } from '~/utils/date'
import { getCookie } from '~/utils/crypto'
import type { Travel, TraccarDevice, TraccarEvent } from '~/types/traccar'

export const useTraccar = () => {
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

  const route = useState<any[]>('route', () => [])
  const events = useState<TraccarEvent[]>('events', () => [])

  // Payload builder
  const traccarPayload = () => {
    const payload = {
      name: travel.value?.title || 'filename',
      deviceId: device.value.id,
      from: tracdate(startdate.value),
      to: tracdate(stopdate.value),
      maxpoints: '2500',
      travelId: travel.value?.id,
      travelSource: travel.value?.source
    }
    console.log('🔧 traccarPayload() called:')
    console.log('   startdate.value:', startdate.value)
    console.log('   stopdate.value:', stopdate.value)
    console.log('   Formatted from:', payload.from)
    console.log('   Formatted to:', payload.to)
    return payload
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

      // Load saved travel index from cookie or use last travel
      const savedIndex = getCookie('travelindex')
      if (savedIndex && data[parseInt(savedIndex)]) {
        travel.value = data[parseInt(savedIndex)]
      } else {
        travel.value = data[data.length - 1]
      }

      // Update dates from selected travel
      if (travel.value) {
        startdate.value = new Date(travel.value.von)
        stopdate.value = new Date(travel.value.bis)
      }

      // Automatically render the map after loading travels
      const { renderMap } = useMapData()
      console.log('🚀 Initial map render')
      await renderMap()

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
      const data = await $fetch('/api/route', {
        method: 'POST',
        body: payload
      })

      route.value = data
      return data
    } catch (error) {
      console.error('Error fetching route:', error)
      throw error
    }
  }

  // Get events
  const getEvents = async () => {
    try {
      const payload = traccarPayload()
      const data = await $fetch<TraccarEvent[]>('/api/events', {
        method: 'POST',
        body: payload
      })

      events.value = data
      return data
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
      const data = await $fetch<TraccarDevice[]>('/api/devices')
      return data
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
    route,
    events,

    // Methods
    traccarPayload,
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
