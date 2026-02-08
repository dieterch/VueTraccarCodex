import { createTraccarClient } from '../utils/traccar-client'
import {
  getRoutePositions,
  getStandstillPeriods,
  getLastRoutePosition,
  hasCachedData,
  saveRoutePositions,
  saveStandstillPeriods,
  clearCache
} from '../utils/cache'
import { analyzeRoute } from './route-analyzer'
import type { RoutePosition, StandstillPeriod, TraccarDevice, TraccarEvent } from '~/types/traccar'

export class TraccarService {
  private client = createTraccarClient()
  private config = useRuntimeConfig()

  async getDevices(): Promise<TraccarDevice[]> {
    return await this.client.getDevices()
  }

  async getEvents(deviceId: number, from: string, to: string): Promise<TraccarEvent[]> {
    console.log(`getEvents: deviceId=${deviceId}, from=${from}, to=${to}`)
    return await this.client.getEvents(deviceId, from, to)
  }

  /**
   * Get route data with cache-first strategy
   * Fetches from cache, then incrementally updates with new data
   */
  async getRouteData(deviceId: number, from: string, to: string): Promise<RoutePosition[]> {
    // Check if we have cached data
    if (!hasCachedData(deviceId)) {
      console.log('No cached data found, triggering prefetch')
      await this.prefetchRouteData(deviceId)
    } else {
      // Update cache with new data since last cached position
      await this.updateCache(deviceId)
    }

    // Return filtered data for requested time range
    return getRoutePositions(deviceId, from, to)
  }

  /**
   * Update cache with new data since last cached position
   */
  private async updateCache(deviceId: number): Promise<void> {
    try {
      const lastPosition = getLastRoutePosition(deviceId)
      if (!lastPosition) return

      // Convert fixTime to proper ISO format (Traccar expects ISO 8601)
      const lastDate = new Date(lastPosition.fixTime).toISOString()
      const now = new Date().toISOString()

      console.log(`Updating cache from ${lastDate} to ${now}`)

      // Fetch new data
      const newPositions = await this.client.getRoute(deviceId, lastDate, now)

      // Filter out positions already in cache
      const filteredPositions = newPositions.filter(p => p.id > lastPosition.id)

      if (filteredPositions.length === 0) {
        console.log('No new positions to add')
        return
      }

      // Analyze new route segment
      const { route, standstills } = await this.analyzeExtendedRoute(
        filteredPositions,
        lastPosition.totalDistance
      )

      // Save to cache
      saveRoutePositions(route, deviceId)
      saveStandstillPeriods(standstills, deviceId)

      console.log(`Added ${route.length} new positions, ${standstills.length} new standstills`)
    } catch (error) {
      console.error('Error updating cache:', error)
      // Don't throw - allow using existing cache data
    }
  }

  /**
   * Analyze extended route (incremental update)
   * Continues totalDistance from previous segment
   */
  private async analyzeExtendedRoute(
    positions: any[],
    lastTotalDistance: number
  ): Promise<{ route: RoutePosition[]; standstills: StandstillPeriod[] }> {
    if (positions.length === 0) {
      return { route: [], standstills: [] }
    }

    // Convert to RoutePosition format
    const routePositions: RoutePosition[] = positions.map(p => ({
      id: p.id,
      deviceId: p.deviceId,
      fixTime: p.fixTime,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude,
      speed: p.speed,
      totalDistance: 0,
      attributes: p.attributes
    }))

    // Analyze route
    const config = useRuntimeConfig()
    const standPeriod = parseInt(config.standPeriod as string) || 12
    const { route, standstills } = await analyzeRoute(routePositions, standPeriod)

    // Add last total distance to all positions
    for (const pos of route) {
      pos.totalDistance += lastTotalDistance
    }

    return { route, standstills }
  }

  /**
   * Prefetch all historical route data
   * Fetches data from startDate to now, analyzes it, and caches it
   */
  async prefetchRouteData(deviceId: number): Promise<{ records: number; time: number }> {
    const startTime = Date.now()
    const config = useRuntimeConfig()
    const startDate = config.startDate as string
    const now = new Date().toISOString()

    console.log(`Prefetching route data for device ${deviceId} from ${startDate} to ${now}`)

    // Fetch all data
    const positions = await this.client.getRoute(deviceId, startDate, now)

    // Convert to RoutePosition format
    const routePositions: RoutePosition[] = positions.map(p => ({
      id: p.id,
      deviceId: p.deviceId,
      fixTime: p.fixTime,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude,
      speed: p.speed,
      totalDistance: 0,
      attributes: p.attributes
    }))

    // Analyze route
    const standPeriod = parseInt(config.standPeriod as string) || 12
    const { route, standstills } = await analyzeRoute(routePositions, standPeriod)

    // Save to cache
    saveRoutePositions(route, deviceId)
    saveStandstillPeriods(standstills, deviceId)

    const elapsed = (Date.now() - startTime) / 1000

    console.log(
      `Prefetch complete: ${route.length} positions, ${standstills.length} standstills, ${elapsed.toFixed(2)}s`
    )

    return {
      records: route.length,
      time: elapsed
    }
  }

  /**
   * Delete prefetched cache
   */
  async deletePrefetch(deviceId: number): Promise<string> {
    clearCache(deviceId)
    return `Cache cleared for device ${deviceId}`
  }

  /**
   * Get standstill periods for a device
   */
  async getStandstillPeriods(deviceId: number): Promise<StandstillPeriod[]> {
    // Ensure cache is up to date
    if (!hasCachedData(deviceId)) {
      await this.prefetchRouteData(deviceId)
    } else {
      await this.updateCache(deviceId)
    }

    return getStandstillPeriods(deviceId)
  }

  async getGeofences(): Promise<any[]> {
    return await this.client.getGeofences()
  }
}

export function createTraccarService(): TraccarService {
  return new TraccarService()
}
