export interface TraccarDevice {
  id: number
  name: string
  uniqueId: string
  status: string
  lastUpdate: string
  positionId: number
  groupId: number
  phone?: string
  model?: string
  contact?: string
  category?: string
  disabled: boolean
}

export interface TraccarPosition {
  id: number
  deviceId: number
  protocol: string
  deviceTime: string
  fixTime: string
  serverTime: string
  latitude: number
  longitude: number
  altitude: number
  speed: number
  course: number
  address?: string
  accuracy: number
  network?: any
  attributes: Record<string, any>
}

export interface TraccarEvent {
  id: number
  type: string
  eventTime: string
  deviceId: number
  positionId: number
  geofenceId: number
  maintenanceId?: number
  attributes: Record<string, any>
}

export interface RoutePosition {
  id: number
  deviceId: number
  fixTime: string
  latitude: number
  longitude: number
  altitude: number
  speed: number
  totalDistance: number
  attributes: Record<string, any>
}

export interface StandstillPeriod {
  id?: number
  deviceId: number
  von: string  // ISO datetime
  bis: string  // ISO datetime
  period: number  // hours
  country: string
  address: string
  latitude: number
  longitude: number
  key: string
}

export interface RouteData {
  positions: RoutePosition[]
  standstills: StandstillPeriod[]
}

export interface MapBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface MapCenter {
  lat: number
  lng: number
}

export interface MapMarker {
  key: string
  lat: number
  lng: number
  title: string
  von: string
  bis: string
  period: number
  country: string
  address: string
  isPOI?: boolean      // identifies POI markers
  poiId?: number       // POI database ID for deletion
}

export interface SideTripDevice {
  deviceId: number
  deviceName: string
  color: string
  lineWeight: number
  enabled: boolean
}

export interface StandstillAdjustment {
  standstill_key: string
  start_adjustment_minutes: number
  end_adjustment_minutes: number
  created_at?: string
  updated_at?: string
}

export interface ManualPOI {
  id: number
  poi_key: string
  latitude: number
  longitude: number
  timestamp: string
  device_id: number
  address: string
  country: string
  created_at: string
  updated_at: string
}

export interface DevicePolyline {
  deviceId: number
  deviceName: string
  color: string
  lineWeight: number
  path: Array<{ lat: number; lng: number; timestamp?: string }>
  isMainDevice: boolean
}

export interface PlotMapsResponse {
  bounds: MapBounds
  center: MapCenter
  zoom: number
  distance: number
  polygone: Array<{ lat: number; lng: number }> // Deprecated: kept for backward compatibility
  polylines: DevicePolyline[] // New: supports multiple device routes
  locations: MapMarker[]
}
