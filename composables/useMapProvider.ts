import { computed } from 'vue'
import type { MapProviderId } from '~/utils/map-adapters/MapAdapter'
import { getMapAdapterById, mapAdapters } from '~/utils/map-adapters'

const MAP_PROVIDER_STORAGE_KEY = 'mapProvider'
const MAP_PROVIDER_STATE_KEY = 'mapProvider'
const MAP_PROVIDER_INIT_KEY = 'mapProviderInit'

export const useMapProvider = () => {
  const provider = useState<MapProviderId>(MAP_PROVIDER_STATE_KEY, () => 'google')
  const initialized = useState<boolean>(MAP_PROVIDER_INIT_KEY, () => false)

  if (process.client && !initialized.value) {
    const stored = window.localStorage.getItem(MAP_PROVIDER_STORAGE_KEY)
    if (stored === 'google' || stored === 'osm') {
      provider.value = stored
    }
    initialized.value = true
  }

  const setMapProvider = (next: MapProviderId) => {
    provider.value = next
    if (process.client) {
      window.localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, next)
    }
  }

  const activeMapAdapter = computed(() => getMapAdapterById(provider.value))

  return {
    mapProvider: provider,
    mapAdapters,
    activeMapAdapter,
    setMapProvider
  }
}

