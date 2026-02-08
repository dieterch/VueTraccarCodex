import { createTraccarService } from '../services/traccar.service'
import { generateKML } from '../services/kml-generator'
import { createWordPressService } from '../services/wordpress.service'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { deviceId, from, to, name } = body

    if (!deviceId || !from || !to) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: deviceId, from, to'
      })
    }

    const traccarService = createTraccarService()
    const wordpressService = createWordPressService()

    // Get route data
    const route = await traccarService.getRouteData(deviceId, from, to)

    if (route.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No route data found for specified period'
      })
    }

    // Get standstill periods
    const standstills = await traccarService.getStandstillPeriods(deviceId)

    // Filter standstills to match the time range
    const fromTime = new Date(from).getTime()
    const toTime = new Date(to).getTime()
    const filtered = standstills.filter(s => {
      const standstillStart = new Date(s.von).getTime()
      const standstillEnd = new Date(s.bis).getTime()
      // Include standstill if it overlaps with the requested time range
      return standstillStart <= toTime && standstillEnd >= fromTime
    })

    // Fetch WordPress titles for each standstill
    const filteredStandstills = await Promise.all(
      filtered.map(async (s) => {
        let customTitle: string | undefined

        try {
          // Try to get WordPress post with the standstill key as tag
          const posts = await wordpressService.getPostsByTag(s.key, 1)
          if (posts && posts.length > 0) {
            customTitle = posts[0].title.rendered
            console.log(`Found WordPress title for ${s.key}: ${customTitle}`)
          }
        } catch (error) {
          // Silently fail if WordPress is not available or post not found
          console.log(`No WordPress title found for ${s.key}`)
        }

        return {
          ...s,
          customTitle
        }
      })
    )

    // Generate KML
    const kmlName = name || `Route_${from}_${to}`
    const kmlContent = generateKML(route, {
      name: kmlName,
      maxPoints: 500,
      standstills: filteredStandstills
    })

    // Set headers for file download
    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.google-earth.kml+xml',
      'Content-Disposition': `attachment; filename="${kmlName}.kml"`
    })

    return kmlContent
  } catch (error: any) {
    console.error('Error in /api/download.kml:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to generate KML'
    })
  }
})
