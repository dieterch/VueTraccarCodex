import { defineAsyncComponent } from 'vue'
import type { MapAdapter } from './MapAdapter'

export const leafletAdapter: MapAdapter = {
  id: 'osm',
  label: 'OpenStreetMap',
  component: defineAsyncComponent(() => import('~/components/maps/LeafletAdapter.vue'))
}

