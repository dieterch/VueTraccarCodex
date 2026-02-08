
/**
 * Strip Plus Code from address (e.g., "2HCR+WM Krk, Croatia" → "Krk, Croatia")
 */
export const stripPlusCode = (address: string): string => {
  // Plus Code pattern: 4 chars + plus sign + 2-3 chars, followed by space
  return address.replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}\s+/, '')
}

/**
 * Convert decimal degrees to degrees/minutes/seconds format for Google Maps URL
 */
export const DECtoDMS = (dd: string): string => {
  const vars = dd.split('.')
  const deg = vars[0]
  let tempma = parseFloat('0.' + vars[1])
  tempma = tempma * 3600
  const min = Math.floor(tempma / 60)
  const sec = tempma - (min * 60)
  return `${deg}%C2%B0${min}'${sec}%22`
}

/**
 * Generate Google Maps link for coordinates
 */
export const GoogleMapsLink = (lat: number, lng: number): string => {
  const latDir = lat > 0 ? 'N' : 'S'
  const lngDir = lng > 0 ? 'E' : 'W'
  return `https://www.google.com/maps/place/${DECtoDMS(String(Math.abs(lat)))}${latDir}+${DECtoDMS(String(Math.abs(lng)))}${lngDir}/@${lat},${lng},12z`
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6373.0 // Earth radius in km
  const lat1r = (lat1 * Math.PI) / 180
  const lng1r = (lng1 * Math.PI) / 180
  const lat2r = (lat2 * Math.PI) / 180
  const lng2r = (lng2 * Math.PI) / 180

  const dlat = lat2r - lat1r
  const dlng = lng2r - lng1r

  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dlng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
