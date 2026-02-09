export interface Travel {
  id?: string
  title: string
  von: string  // ISO datetime
  bis: string  // ISO datetime
  distance: number  // km
  source?: 'auto' | 'manual'
  deviceId?: number
  notes?: string
  created_at?: string
  farthestStandstill?: {
    key: string
    distance: number
    address: string
    country: string
  }
}

export interface TravelPatch {
  von: string
  bis: string
  farthest?: string
  address?: string
  title?: string
}

export interface TravelsYaml {
  [key: string]: TravelPatch
}
