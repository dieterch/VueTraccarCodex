import type { RoutePosition, StandstillPeriod } from '~/types/traccar'

const KML_COLORS = [
  'ff0000ff', // Red (AABBGGRR format)
  'ffadd8e6', // Light Blue
  'ffc1b6ff', // Light Pink
  'ff90ee90', // Light Green
  'ff00ffff', // Yellow
  'ff00a5ff', // Orange
  'ffff00ff'  // Magenta
]

interface KMLOptions {
  name: string
  maxPoints?: number
  standstills?: (StandstillPeriod & { customTitle?: string })[]
}

/**
 * Generate KML file content from route positions
 */
export function generateKML(positions: RoutePosition[], options: KMLOptions): string {
  const { name, maxPoints = 500, standstills = [] } = options

  // Pick random color
  const color = KML_COLORS[Math.floor(Math.random() * KML_COLORS.length)]

  // Convert positions to coordinates
  const coords = positions.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitude
  }))

  // Build KML XML
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
  lines.push(`  <Document>`)
  lines.push(`    <name>${escapeXml(name)}</name>`)
  lines.push(`    <open>1</open>`)

  // Shared style for route
  lines.push(`    <Style id="routeStyle">`)
  lines.push(`      <LineStyle>`)
  lines.push(`        <color>${color}</color>`)
  lines.push(`        <width>4</width>`)
  lines.push(`      </LineStyle>`)
  lines.push(`      <LabelStyle>`)
  lines.push(`        <color>${color}</color>`)
  lines.push(`        <scale>1</scale>`)
  lines.push(`      </LabelStyle>`)
  lines.push(`      <IconStyle>`)
  lines.push(`        <color>${color}</color>`)
  lines.push(`        <scale>1</scale>`)
  lines.push(`        <Icon>`)
  lines.push(`          <href>http://maps.google.com/mapfiles/kml/paddle/pink-stars.png</href>`)
  lines.push(`        </Icon>`)
  lines.push(`      </IconStyle>`)
  lines.push(`    </Style>`)

  // Style for standstill markers
  lines.push(`    <Style id="standstillStyle">`)
  lines.push(`      <IconStyle>`)
  lines.push(`        <color>ff0000ff</color>`) // Red color
  lines.push(`        <scale>1.2</scale>`)
  lines.push(`        <Icon>`)
  lines.push(`          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>`)
  lines.push(`        </Icon>`)
  lines.push(`      </IconStyle>`)
  lines.push(`      <LabelStyle>`)
  lines.push(`        <scale>0.9</scale>`)
  lines.push(`      </LabelStyle>`)
  lines.push(`    </Style>`)

  // Folder for line strings
  lines.push(`    <Folder>`)
  lines.push(`      <name>LineStrings</name>`)

  // Split into chunks
  const totalPoints = coords.length
  const numChunks = Math.ceil(totalPoints / maxPoints)

  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const startIndex = chunkIndex * maxPoints
    const endIndex = Math.min(startIndex + maxPoints, totalPoints)
    const chunkCoords = coords.slice(startIndex, endIndex)

    lines.push(`      <Placemark>`)
    lines.push(`        <name>Route_${chunkIndex}</name>`)
    lines.push(`        <styleUrl>#routeStyle</styleUrl>`)
    lines.push(`        <LineString>`)
    lines.push(`          <altitudeMode>clampToGround</altitudeMode>`)
    lines.push(`          <tessellate>1</tessellate>`)
    lines.push(`          <coordinates>`)

    // Add coordinates (longitude,latitude,altitude)
    for (const coord of chunkCoords) {
      lines.push(`            ${coord.longitude},${coord.latitude},${coord.altitude}`)
    }

    lines.push(`          </coordinates>`)
    lines.push(`        </LineString>`)
    lines.push(`      </Placemark>`)
  }

  lines.push(`    </Folder>`)

  // Folder for standstill markers
  if (standstills.length > 0) {
    lines.push(`    <Folder>`)
    lines.push(`      <name>Standstill Locations</name>`)

    for (let i = 0; i < standstills.length; i++) {
      const standstill = standstills[i]
      const durationHours = standstill.period.toFixed(1)
      const fromDate = new Date(standstill.von).toLocaleString()
      const toDate = new Date(standstill.bis).toLocaleString()
      const title = getStandstillTitle(standstill)

      lines.push(`      <Placemark>`)
      lines.push(`        <name>${escapeXml(title)}</name>`)
      lines.push(`        <description><![CDATA[`)
      lines.push(`          <b>Duration:</b> ${durationHours} hours<br/>`)
      lines.push(`          <b>From:</b> ${fromDate}<br/>`)
      lines.push(`          <b>To:</b> ${toDate}<br/>`)
      if (standstill.address) {
        lines.push(`          <b>Address:</b> ${escapeXml(standstill.address)}<br/>`)
      }
      if (standstill.country) {
        lines.push(`          <b>Country:</b> ${escapeXml(standstill.country)}<br/>`)
      }
      lines.push(`          <b>Coordinates:</b> ${standstill.latitude.toFixed(6)}, ${standstill.longitude.toFixed(6)}`)
      lines.push(`        ]]></description>`)
      lines.push(`        <styleUrl>#standstillStyle</styleUrl>`)
      lines.push(`        <Point>`)
      lines.push(`          <coordinates>${standstill.longitude},${standstill.latitude},0</coordinates>`)
      lines.push(`        </Point>`)
      lines.push(`      </Placemark>`)
    }

    lines.push(`    </Folder>`)
  }

  lines.push(`  </Document>`)
  lines.push(`</kml>`)

  return lines.join('\n')
}

/**
 * Strip Plus Code from address (e.g., "2HCR+WM Krk, Croatia" → "Krk, Croatia")
 */
function stripPlusCode(address: string): string {
  // Plus Code pattern: 4 chars + plus sign + 2-3 chars, followed by space
  return address.replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}\s+/, '')
}

/**
 * Get a descriptive title for a standstill location
 */
function getStandstillTitle(standstill: StandstillPeriod & { customTitle?: string }): string {
  // First priority: use custom title from travels.yml / WordPress if available
  if (standstill.customTitle) {
    return standstill.customTitle
  }

  // Second priority: use the address without Plus Code as the title
  if (standstill.address) {
    const cleanAddress = stripPlusCode(standstill.address)
    if (cleanAddress && cleanAddress.trim()) {
      return cleanAddress
    }
  }

  // Third priority: fallback to country name if address is not available
  if (standstill.country) {
    return standstill.country
  }

  // Last resort: use coordinates
  return `${standstill.latitude.toFixed(4)}, ${standstill.longitude.toFixed(4)}`
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function createKMLGenerator() {
  return {
    generate: generateKML
  }
}
