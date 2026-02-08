import type { RoutePosition, StandstillPeriod, MapBounds, MapCenter } from '~/types/traccar'

interface Point {
  latitude: number
  longitude: number
  fixTime?: string
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in kilometers
 */
export function calculateDistance(pt1: Point, pt2: Point): number {
  const R = 6373.0 // approximate radius of earth in km
  const lat1r = (pt1.latitude * Math.PI) / 180 // convert to radians
  const lon1r = (pt1.longitude * Math.PI) / 180
  const lat2r = (pt2.latitude * Math.PI) / 180
  const lon2r = (pt2.longitude * Math.PI) / 180
  const dlon = lon2r - lon1r
  const dlat = lat2r - lat1r

  // Haversine formula
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dlon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance // in km
}

/**
 * Calculate time difference between two points
 * @returns time difference in seconds
 */
export function calculateTimeDiff(pt1: Point, pt2: Point): number {
  if (!pt1.fixTime || !pt2.fixTime) return 0

  const time1 = new Date(pt1.fixTime).getTime()
  const time2 = new Date(pt2.fixTime).getTime()

  return (time2 - time1) / 1000 // convert to seconds
}

/**
 * Reverse geocode a position using Google Maps API
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ country: string; address: string }> {
  const config = useRuntimeConfig()
  const apiKey = config.public.googleMapsApiKey

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    const response = await $fetch<any>(url)

    if (response.status === 'OK' && response.results.length > 0) {
      const result = response.results[0]
      const addressComponents = result.address_components

      // Get country (last or second-to-last component)
      const countryComponent = addressComponents.find((comp: any) =>
        comp.types.includes('country')
      )
      const country = countryComponent?.long_name || 'Unknown'

      return {
        country,
        address: result.formatted_address
      }
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error)
  }

  return {
    country: 'Unknown',
    address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

/**
 * Analyze route to detect standstill periods
 * Returns route with totalDistance calculated and standstill periods
 */
export async function analyzeRoute(
  route: RoutePosition[],
  standPeriodHours: number = 12
): Promise<{ route: RoutePosition[]; standstills: StandstillPeriod[] }> {
  if (route.length === 0) {
    return { route: [], standstills: [] }
  }

  // Reset the first position's total distance
  route[0].totalDistance = 0.0

  let totalDist = 0.0
  const standPeriods: StandstillPeriod[] = []
  let samplePeriod: Array<{ lat: number; lng: number }> = []
  let stop: RoutePosition | null = null
  let start: RoutePosition | null = null
  let standstill = false

  for (let i = 0; i < route.length - 1; i++) {
    const d = calculateDistance(route[i], route[i + 1])
    totalDist += d
    route[i].totalDistance = totalDist

    if (d < 0.1) {
      // Distance less than 100m, vehicle is standing still
      if (!standstill) {
        standstill = true
        stop = route[i]
      }
      samplePeriod.push({
        lat: route[i].latitude,
        lng: route[i].longitude
      })
    } else {
      // Vehicle is moving
      if (standstill && stop) {
        standstill = false
        start = route[i]
        const period = calculateTimeDiff(stop, start)

        // If period is longer than standPeriodHours
        if (period > standPeriodHours * 3600.0) {
          const plat = samplePeriod.reduce((sum, p) => sum + p.lat, 0) / samplePeriod.length
          const plng = samplePeriod.reduce((sum, p) => sum + p.lng, 0) / samplePeriod.length

          const { country, address } = await reverseGeocode(plat, plng)

          const von = stop.fixTime.replace('T', ' ').substring(0, 16)
          const bis = start.fixTime.replace('T', ' ').substring(0, 16)
          const key = `marker${String(plat).substring(0, 7)}${String(plng).substring(0, 7)}`
            .replace(/\./g, '')
            .replace(/-/g, 'M')

          standPeriods.push({
            deviceId: route[i].deviceId,
            von,
            bis,
            period: Math.round(period / 360.0 / 10.0),
            country,
            address,
            latitude: plat,
            longitude: plng,
            key
          })
        }

        samplePeriod = []
      }
    }
  }

  // Set total distance for last position
  if (route.length > 0) {
    route[route.length - 1].totalDistance = totalDist
  }

  return { route, standstills: standPeriods }
}

/**
 * Calculate map bounds from route positions
 */
export function calculateBounds(positions: RoutePosition[]): MapBounds {
  if (positions.length === 0) {
    return {
      minLat: 0,
      maxLat: 0,
      minLng: 0,
      maxLng: 0
    }
  }

  const lats = positions.map(p => p.latitude)
  const lngs = positions.map(p => p.longitude)

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs)
  }
}

/**
 * Calculate map center from bounds
 */
export function calculateCenter(bounds: MapBounds): MapCenter {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2
  }
}

/**
 * Calculate zoom level based on bounds
 */
export function calculateZoom(bounds: MapBounds): number {
  const nw = { latitude: bounds.maxLat, longitude: bounds.minLng }
  const ne = { latitude: bounds.maxLat, longitude: bounds.maxLng }
  const sw = { latitude: bounds.minLat, longitude: bounds.minLng }

  const extx = calculateDistance(nw, ne)
  const exty = calculateDistance(nw, sw)
  const ext = Math.sqrt(extx ** 2 + exty ** 2)

  const zoom = 35.936 * (ext + 150) ** -0.243

  console.log(`zoom: ext:${ext.toFixed(1)},(x:${extx.toFixed(1)} y:${exty.toFixed(1)}) zoom: ${zoom}`)

  return zoom
}

/**
 * Clean and merge nearby standstill periods
 */
export function cleanStandstillPeriods(standPeriods: StandstillPeriod[]): StandstillPeriod[] {
  const periods = [...standPeriods]

  // Combine periods that are close to each other
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const latDiff = periods[i].latitude - periods[j].latitude
      const lngDiff = periods[i].longitude - periods[j].longitude
      const diff = Math.sqrt(latDiff ** 2 + lngDiff ** 2)

      if (diff < 0.005) {
        if (periods[i].period > 0 && periods[j].period > 0) {
          periods[i].period += periods[j].period
          periods[j].period = 0
        }
      }
    }
  }

  return periods.filter(d => d.period > 0)
}

/**
 * Filter standstill periods by time range
 */
export function filterStandstillPeriods(
  standPeriods: StandstillPeriod[],
  from: string,
  to: string
): StandstillPeriod[] {
  const fromDate = new Date(from)
  fromDate.setHours(fromDate.getHours() - 8) // shift by -8 hours

  const toDate = new Date(to)
  toDate.setHours(toDate.getHours() + 8) // shift by +8 hours

  return standPeriods.filter(p => {
    const vonDate = new Date(p.von)
    const bisDate = new Date(p.bis)
    return vonDate >= fromDate && bisDate <= toDate
  })
}

/**
 * Translate country names to German
 */
export function translateCountry(country: string): string {
  const translations: Record<string, string> = {
    'Austria': 'Österreich',
    'Albania': 'Albanien',
    'Croatia': 'Kroatien',
    'France': 'Frankreich',
    'Germany': 'Deutschland',
    'Greece': 'Griechenland',
    'Italy': 'Italien',
    'Slovenia': 'Slowenien',
    'Switzerland': 'Schweiz'
  }

  return translations[country] || country
}
