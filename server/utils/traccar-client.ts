import type { TraccarDevice, TraccarPosition, TraccarEvent } from '~/types/traccar'

export class TraccarClient {
  private baseUrl: string
  private auth: { username: string; password: string }

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl
    this.auth = { username, password }
  }

  private getHeaders() {
    const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64')
    return {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json; charset=utf-8'
    }
  }

  async getDevices(): Promise<TraccarDevice[]> {
    try {
      const response = await $fetch<TraccarDevice[]>(`${this.baseUrl}/api/devices`, {
        headers: this.getHeaders(),
        timeout: 100000
      })
      return response
    } catch (error) {
      console.error('Traccar API error (getDevices):', error)
      throw error
    }
  }

  async getEvents(deviceId: number, from: string, to: string): Promise<TraccarEvent[]> {
    try {
      const response = await $fetch<TraccarEvent[]>(`${this.baseUrl}/api/reports/events`, {
        headers: this.getHeaders(),
        params: {
          deviceId,
          from,
          to
        },
        timeout: 100000
      })
      return response
    } catch (error) {
      console.error('Traccar API error (getEvents):', error)
      throw error
    }
  }

  async getRoute(deviceId: number, from: string, to: string): Promise<TraccarPosition[]> {
    try {
      console.log(`Traccar API: getRoute device:${deviceId} from:${from} to:${to}`)
      const response = await $fetch<TraccarPosition[]>(`${this.baseUrl}/api/reports/route`, {
        headers: this.getHeaders(),
        params: {
          deviceId,
          from,
          to
        },
        timeout: 100000
      })

      // Filter out positions with very long distances (invalid data)
      const filtered = response.filter(p => {
        const distance = p.attributes?.distance || 0
        return distance < 1000000.0
      })

      console.log(`Traccar API: loaded ${response.length} positions, ${response.length - filtered.length} filtered`)

      return filtered
    } catch (error) {
      console.error('Traccar API error (getRoute):', error)
      throw error
    }
  }

  async getPosition(positionId?: number): Promise<TraccarPosition[]> {
    try {
      const params = positionId ? { id: positionId } : {}
      const response = await $fetch<TraccarPosition[]>(`${this.baseUrl}/api/positions`, {
        headers: this.getHeaders(),
        params,
        timeout: 100000
      })
      return response
    } catch (error) {
      console.error('Traccar API error (getPosition):', error)
      throw error
    }
  }

  async getGeofences(): Promise<any[]> {
    try {
      const response = await $fetch<any[]>(`${this.baseUrl}/api/geofences`, {
        headers: this.getHeaders(),
        timeout: 100000
      })
      return response
    } catch (error) {
      console.error('Traccar API error (getGeofences):', error)
      throw error
    }
  }
}

export function createTraccarClient(): TraccarClient {
  const config = useRuntimeConfig()
  return new TraccarClient(
    config.traccarUrl as string,
    config.traccarUser as string,
    config.traccarPassword as string
  )
}
