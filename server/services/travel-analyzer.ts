import { readFile } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import { join } from 'path'
import type { TraccarEvent, StandstillPeriod } from '~/types/traccar'
import type { Travel, TravelPatch, TravelsYaml } from '~/types/route'
import { calculateDistance, filterStandstillPeriods } from './route-analyzer'
import { stripPlusCode } from '~/utils/maps'

export class TravelAnalyzer {
  private config = useRuntimeConfig()
  private travelPatches: TravelsYaml = {}
  private homeGeofenceId: number = 1

  // /**
  //  * Strip Plus Code from address (e.g., "2HCR+WM Krk, Croatia" → "Krk, Croatia")
  //  */
  // private stripPlusCode(address: string): string {
  //   // Plus Code pattern: 4 chars + plus sign + 2-3 chars, followed by space
  //   return address.replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}\s+/, '')
  // }

  /**
   * Find patches for travel key with fuzzy matching
   * Tries exact match first, then without Plus Code
   */
  private findPatches(address: string): Partial<TravelPatch> {
    // Try exact match first
    if (this.travelPatches[address]) {
      return this.travelPatches[address]
    }

    // Try without Plus Code
    // const stripped = this.stripPlusCode(address)
    const stripped = stripPlusCode(address)
    if (stripped !== address && this.travelPatches[stripped]) {
      console.log(`Matched '${address}' → '${stripped}' (Plus Code stripped)`)
      return this.travelPatches[stripped]
    }

    return {}
  }

  /**
   * Get custom title for an address from travel patches
   * Returns undefined if no custom title is found
   */
  getTitleForAddress(address: string): string | undefined {
    const patches = this.findPatches(address)
    return patches.title
  }

  /**
   * Check if geofence exit event is valid
   */
  private isExitValid(events: TraccarEvent[], index: number): boolean {
    if (index <= 0) return true

    const currentEvent = events[index]
    const previousEvent = events[index - 1]
    const eventMinGap = this.config.eventMinGap as number

    const currentTime = new Date(currentEvent.serverTime).getTime()
    const previousTime = new Date(previousEvent.serverTime).getTime()
    const gapSeconds = (currentTime - previousTime) / 1000

    if (gapSeconds < eventMinGap) {
      console.log(
        `getTravels: skip exit ${index} (${currentEvent.type}), ` +
        `${currentEvent.serverTime}, too close to ${previousEvent.serverTime}`
      )
      return false
    }

    return true
  }

  /**
   * Check if geofence return event is valid
   */
  private isReturnValid(events: TraccarEvent[], index: number): boolean {
    if (index >= events.length - 1) return true

    const currentEvent = events[index]
    const nextEvent = events[index + 1]
    const eventMinGap = this.config.eventMinGap as number

    const nextTime = new Date(nextEvent.serverTime).getTime()
    const currentTime = new Date(currentEvent.serverTime).getTime()
    const gapSeconds = (nextTime - currentTime) / 1000

    if (gapSeconds < eventMinGap) {
      console.log(
        `getTravels: skip return ${index} (${currentEvent.type}), ` +
        `${currentEvent.serverTime}, too close to ${nextEvent.serverTime}`
      )
      return false
    }

    return true
  }

  /**
   * Find farthest standstill from home
   */
  private findFarthestStandstill(
    standPeriods: StandstillPeriod[]
  ): StandstillPeriod & { distance: number } | null {
    if (standPeriods.length === 0) {
      return null
    }

    const home = {
      latitude: parseFloat(this.config.homeLatitude as string),
      longitude: parseFloat(this.config.homeLongitude as string)
    }

    // Calculate distance from home for each standstill
    const withDistances = standPeriods.map(p => ({
      ...p,
      distance: calculateDistance(home, { latitude: p.latitude, longitude: p.longitude })
    }))

    // Sort by distance (descending) and return farthest
    withDistances.sort((a, b) => b.distance - a.distance)

    return withDistances[0]
  }

  /**
   * Load geofence settings from settings.yml
   */
  private async loadGeofenceSettings(): Promise<void> {
    try {
      const yamlPath = join(process.cwd(), 'data', 'settings.yml')
      const content = await readFile(yamlPath, 'utf-8')
      const data = parseYaml(content) || {}

      if (data.homeGeofenceId !== undefined) {
        this.homeGeofenceId = data.homeGeofenceId
        console.log(`Loaded home geofence ID from settings.yml: ${this.homeGeofenceId}`)
      } else {
        this.homeGeofenceId = this.config.homeGeofenceId as number
        console.log(`Using default home geofence ID from .env: ${this.homeGeofenceId}`)
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.homeGeofenceId = this.config.homeGeofenceId as number
        console.log(`settings.yml not found, using default home geofence ID: ${this.homeGeofenceId}`)
      } else {
        console.error('Error loading geofence settings:', error)
        this.homeGeofenceId = this.config.homeGeofenceId as number
      }
    }
  }

  /**
   * Load travel patches from database
   */
  async loadTravelPatches(): Promise<void> {
    try {
      // Load from app database (persistent data)
      const { getTravelPatches } = await import('../utils/app-db')
      const patches = getTravelPatches()

      const cleaned: TravelsYaml = {}
      for (const patch of patches) {
        const entry: any = {}

        if (patch.title) entry.title = patch.title
        if (patch.from_date) entry.von = patch.from_date
        if (patch.to_date) entry.bis = patch.to_date
        if (patch.exclude) entry.exclude = true

        if (Object.keys(entry).length > 0) {
          cleaned[patch.address_key] = entry
        }
      }

      this.travelPatches = cleaned
      console.log(`Loaded ${patches.length} travel patches from database`)
    } catch (error: any) {
      console.error('Error loading travel patches from database:', error)
      // Fallback to YAML if database fails
      console.log('Falling back to travels.yml...')
      await this.loadTravelPatchesFromYaml()
    }
  }

  /**
   * Load travel patches from travels.yml (fallback)
   */
  private async loadTravelPatchesFromYaml(): Promise<void> {
    try {
      const yamlPath = join(process.cwd(), 'data', 'travels.yml')
      const content = await readFile(yamlPath, 'utf-8')
      const data = parseYaml(content) || {}

      // Clean patches: remove null/empty values
      const cleaned: TravelsYaml = {}
      for (const [key, entry] of Object.entries(data)) {
        if (entry && typeof entry === 'object') {
          const filtered: any = {}
          for (const [k, v] of Object.entries(entry)) {
            if (v !== null && v !== '' && v !== undefined) {
              filtered[k] = v
            }
          }
          if (Object.keys(filtered).length > 0) {
            cleaned[key] = filtered
          }
        }
      }

      this.travelPatches = cleaned
      console.log(`Loaded ${Object.keys(cleaned).length} travel patches from travels.yml`)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('travels.yml not found, starting with empty patches')
        this.travelPatches = {}
      } else {
        console.error('Error loading travel patches:', error)
        this.travelPatches = {}
      }
    }
  }

  /**
   * Create a travel from exit/enter events and standstills
   */
  private createTravel(
    exitTime: Date,
    enterTime: Date,
    standPeriods: StandstillPeriod[],
    deviceId: number
  ): Travel | null {
    const minDays = this.config.minDays as number
    const maxDays = this.config.maxDays as number

    const durationDays = (enterTime.getTime() - exitTime.getTime()) / (1000 * 60 * 60 * 24)

    console.log(
      `Evaluating travel: ${exitTime.toISOString()} → ${enterTime.toISOString()} (${durationDays.toFixed(1)} days)`
    )

    // Check duration constraints
    if (durationDays <= minDays || durationDays >= maxDays) {
      console.log(`Travel duration ${durationDays.toFixed(1)} days outside range [${minDays}, ${maxDays}]`)
      return null
    }

    // Find farthest standstill
    const farthest = this.findFarthestStandstill(standPeriods)

    if (!farthest || farthest.distance <= 1) {
      console.log(`No valid farthest standstill (distance: ${farthest?.distance || 0} km)`)
      return null
    }

    const travelKey = farthest.address
    console.log(`Farthest standstill: ${travelKey} (distance ${farthest.distance.toFixed(1)} km)`)

    // Get patches for this travel (with fuzzy matching)
    const patches = this.findPatches(travelKey)
    console.log(`Patches found for '${travelKey}':`, patches)

    // Debug: Show available patch keys if no match found
    if (Object.keys(patches).length === 0 && Object.keys(this.travelPatches).length > 0) {
      console.log(`Available patch keys (${Object.keys(this.travelPatches).length}):`)
      Object.keys(this.travelPatches).forEach(key => {
        console.log(`  - "${key}"`)
      })
      console.log(`Address without Plus Code: "${this.stripPlusCode(travelKey)}"`)
    }

    // Check if excluded
    if (patches.exclude) {
      console.log(`Travel '${travelKey}' excluded by patch`)
      return null
    }

    // Apply patches
    let fromDate = exitTime
    let toDate = enterTime

    if (patches.von) {
      console.log(`Patching FROM: ${fromDate.toISOString()} → ${patches.von}`)
      fromDate = new Date(patches.von)
    }

    if (patches.bis) {
      console.log(`Patching TO: ${toDate.toISOString()} → ${patches.bis}`)
      toDate = new Date(patches.bis)
    }

    // Recalculate duration
    const finalDurationDays = Math.max(0, (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))

    // Determine title
    const title = patches.title || travelKey

    return {
      title,
      von: fromDate.toISOString(),
      bis: toDate.toISOString(),
      distance: farthest.distance,
      farthestStandstill: {
        key: farthest.key,
        distance: farthest.distance,
        address: farthest.address,
        country: farthest.country
      }
    }
  }

  /**
   * Analyze geofence events to detect travels
   */
  async analyzeTravels(
    events: TraccarEvent[],
    standstillPeriods: StandstillPeriod[],
    deviceId: number
  ): Promise<Travel[]> {
    await this.loadGeofenceSettings()
    await this.loadTravelPatches()

    // Filter for home geofence enter/exit events
    const geofenceEvents = events.filter(
      e =>
        e.geofenceId === this.homeGeofenceId &&
        (e.type === 'geofenceEnter' || e.type === 'geofenceExit')
    )

    const travels: Travel[] = []
    let inTravel = false
    let exitTime: Date | null = null

    for (let i = 0; i < geofenceEvents.length; i++) {
      const event = geofenceEvents[i]

      if (event.type === 'geofenceExit') {
        // Validate exit
        if (!this.isExitValid(geofenceEvents, i)) {
          continue
        }

        exitTime = new Date(event.serverTime)
        inTravel = true
      } else if (event.type === 'geofenceEnter' && inTravel && exitTime) {
        // Validate return
        if (!this.isReturnValid(geofenceEvents, i)) {
          continue
        }

        const enterTime = new Date(event.serverTime)

        // Filter standstills for this travel period
        const travelStandstills = filterStandstillPeriods(
          standstillPeriods,
          exitTime.toISOString(),
          enterTime.toISOString()
        )

        // Create travel
        const travel = this.createTravel(exitTime, enterTime, travelStandstills, deviceId)

        if (travel) {
          travels.push(travel)
        }

        inTravel = false
        exitTime = null
      }
    }

    // Handle case where still in travel
    if (inTravel && exitTime) {
      const now = new Date()
      console.log(
        `getTravels: still in travel, exit: ${exitTime.toISOString()}, now: ${now.toISOString()}`
      )

      const travelStandstills = filterStandstillPeriods(
        standstillPeriods,
        exitTime.toISOString(),
        now.toISOString()
      )

      const travel = this.createTravel(exitTime, now, travelStandstills, deviceId)

      if (travel) {
        travels.push(travel)
      }
    }

    console.log(`Detected ${travels.length} travels`)
    return travels
  }
}

export function createTravelAnalyzer(): TravelAnalyzer {
  return new TravelAnalyzer()
}
