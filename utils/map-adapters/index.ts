import type { MapAdapter, MapProviderId } from './MapAdapter'
import { googleMapsAdapter } from './GoogleMapsAdapter'
import { leafletAdapter } from './LeafletAdapter'

export const mapAdapters: MapAdapter[] = [googleMapsAdapter, leafletAdapter]

export const getMapAdapterById = (id: MapProviderId): MapAdapter => {
  return mapAdapters.find((adapter) => adapter.id === id) || googleMapsAdapter
}

