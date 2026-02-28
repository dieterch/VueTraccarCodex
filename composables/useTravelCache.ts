import { del, entries, get, set } from 'idb-keyval'

type TravelCachePayload = {
  plotmaps?: any
  route?: any
  events?: any
  manualPois?: any[]
}

type LiveRoutePoint = {
  lat: number
  lng: number
  timestamp: string
}

type TravelSnapshot = {
  version: number
  savedAt: string
  payload: TravelCachePayload
}

type TravelCacheKeyInput = {
  deviceId?: number
  from?: string
  to?: string
  travelId?: string
  travelSource?: string
}

const CACHE_VERSION = 1
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000
const CACHE_MAX_SNAPSHOTS = 20
const CACHE_KEY_PREFIX = 'travel:'
const LIVE_ROUTE_KEY_PREFIX = 'live-route:'
const LIVE_ROUTE_TTL_MS = 45 * 24 * 60 * 60 * 1000
const LIVE_ROUTE_MAX_KEYS = 16
const LIVE_ROUTE_MAX_POINTS_PER_KEY = 120000
const ONLINE_LISTENER_KEY = 'travelCacheOnlineListenerInit'

const isTravelSnapshot = (value: any): value is TravelSnapshot => {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.version === 'number' &&
    typeof value.savedAt === 'string' &&
    value.payload &&
    typeof value.payload === 'object'
  )
}

export const useTravelCache = () => {
  const isOffline = useState<boolean>('isOffline', () => false)
  const usingCachedTravel = useState<boolean>('usingCachedTravel', () => false)
  const cachedTravelUpdatedAt = useState<string | null>('cachedTravelUpdatedAt', () => null)
  const onlineListenerInit = useState<boolean>(ONLINE_LISTENER_KEY, () => false)

  if (process.client && !onlineListenerInit.value) {
    isOffline.value = !window.navigator.onLine
    const updateOnlineState = () => {
      isOffline.value = !window.navigator.onLine
    }
    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    onlineListenerInit.value = true
  }

  const buildTravelCacheKey = (input: TravelCacheKeyInput) => {
    const source = input.travelSource || 'auto'
    const from = input.from || 'unknown-from'
    const to = input.to || 'unknown-to'
    const deviceId = input.deviceId || 0
    const fallbackId = `auto-${deviceId}-${from}-${to}`
    const travelId = input.travelId || fallbackId
    return `${CACHE_KEY_PREFIX}${source}:${travelId}:${deviceId}:${from}:${to}`
  }

  const buildLiveRouteCacheKey = (input: TravelCacheKeyInput) => {
    const source = input.travelSource || 'auto'
    const deviceId = input.deviceId || 0
    const travelId = input.travelId || `device-${deviceId}`
    return `${LIVE_ROUTE_KEY_PREFIX}${source}:${travelId}:${deviceId}`
  }

  const markCachedDataUsed = (savedAt: string | null) => {
    usingCachedTravel.value = true
    cachedTravelUpdatedAt.value = savedAt
  }

  const markNetworkDataUsed = () => {
    usingCachedTravel.value = false
    cachedTravelUpdatedAt.value = null
  }

  const pruneTravelSnapshots = async () => {
    if (!process.client) return
    const all = await entries()
    const snapshotEntries = all
      .filter(([key, value]) => String(key).startsWith(CACHE_KEY_PREFIX) && isTravelSnapshot(value))
      .map(([key, value]) => ({ key: String(key), snapshot: value as TravelSnapshot }))

    const now = Date.now()
    for (const entry of snapshotEntries) {
      const savedAt = new Date(entry.snapshot.savedAt).getTime()
      if (!Number.isFinite(savedAt) || now - savedAt > CACHE_TTL_MS) {
        await del(entry.key)
      }
    }

    const fresh = (await entries())
      .filter(([key, value]) => String(key).startsWith(CACHE_KEY_PREFIX) && isTravelSnapshot(value))
      .map(([key, value]) => ({ key: String(key), snapshot: value as TravelSnapshot }))
      .sort((a, b) => {
        return new Date(b.snapshot.savedAt).getTime() - new Date(a.snapshot.savedAt).getTime()
      })

    if (fresh.length <= CACHE_MAX_SNAPSHOTS) return

    const toDelete = fresh.slice(CACHE_MAX_SNAPSHOTS)
    for (const entry of toDelete) {
      await del(entry.key)
    }
  }

  const pruneLiveRouteCaches = async () => {
    if (!process.client) return
    const all = await entries()
    const routeEntries = all
      .filter(([key, value]) => String(key).startsWith(LIVE_ROUTE_KEY_PREFIX) && isTravelSnapshot(value))
      .map(([key, value]) => ({ key: String(key), snapshot: value as TravelSnapshot }))

    const now = Date.now()
    for (const entry of routeEntries) {
      const savedAt = new Date(entry.snapshot.savedAt).getTime()
      if (!Number.isFinite(savedAt) || now - savedAt > LIVE_ROUTE_TTL_MS) {
        await del(entry.key)
      }
    }

    const fresh = (await entries())
      .filter(([key, value]) => String(key).startsWith(LIVE_ROUTE_KEY_PREFIX) && isTravelSnapshot(value))
      .map(([key, value]) => ({ key: String(key), snapshot: value as TravelSnapshot }))
      .sort((a, b) => new Date(b.snapshot.savedAt).getTime() - new Date(a.snapshot.savedAt).getTime())

    if (fresh.length <= LIVE_ROUTE_MAX_KEYS) return

    for (const entry of fresh.slice(LIVE_ROUTE_MAX_KEYS)) {
      await del(entry.key)
    }
  }

  const getTravelSnapshot = async (cacheKey: string): Promise<TravelSnapshot | null> => {
    if (!process.client) return null
    const snapshot = await get(cacheKey)
    if (!isTravelSnapshot(snapshot)) return null

    const savedAt = new Date(snapshot.savedAt).getTime()
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > CACHE_TTL_MS) {
      await del(cacheKey)
      return null
    }

    return snapshot
  }

  const saveTravelSnapshot = async (cacheKey: string, payload: TravelCachePayload) => {
    if (!process.client) return

    const existing = await getTravelSnapshot(cacheKey)
    const snapshot: TravelSnapshot = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      payload: {
        ...(existing?.payload || {}),
        ...payload
      }
    }
    await set(cacheKey, snapshot)
    await pruneTravelSnapshots()
  }

  const getLiveRoutePoints = async (cacheKey: string): Promise<LiveRoutePoint[]> => {
    if (!process.client) return []
    const snapshot = await getTravelSnapshot(cacheKey)
    const points = snapshot?.payload?.route
    if (!Array.isArray(points)) return []
    return points
      .filter((point: any) => (
        point &&
        typeof point.lat === 'number' &&
        typeof point.lng === 'number' &&
        typeof point.timestamp === 'string'
      ))
      .map((point: any) => ({
        lat: point.lat,
        lng: point.lng,
        timestamp: point.timestamp
      }))
  }

  const appendLiveRoutePoints = async (
    cacheKey: string,
    nextPoints: LiveRoutePoint[],
    maxPoints = LIVE_ROUTE_MAX_POINTS_PER_KEY
  ) => {
    if (!process.client || nextPoints.length === 0) return
    const existing = await getLiveRoutePoints(cacheKey)
    const merged = [...existing, ...nextPoints]
    const bounded = merged.length > maxPoints ? merged.slice(merged.length - maxPoints) : merged
    await saveTravelSnapshot(cacheKey, { route: bounded })
    await pruneLiveRouteCaches()
  }

  return {
    isOffline,
    usingCachedTravel,
    cachedTravelUpdatedAt,
    buildTravelCacheKey,
    buildLiveRouteCacheKey,
    markCachedDataUsed,
    markNetworkDataUsed,
    getTravelSnapshot,
    getLiveRoutePoints,
    appendLiveRoutePoints,
    saveTravelSnapshot,
    pruneTravelSnapshots,
    pruneLiveRouteCaches
  }
}
