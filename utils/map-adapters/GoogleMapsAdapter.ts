import { defineAsyncComponent } from 'vue'
import type { MapAdapter } from './MapAdapter'

export const googleMapsAdapter: MapAdapter = {
  id: 'google',
  label: 'Google Maps',
  component: defineAsyncComponent(() => import('~/components/maps/GoogleMapsAdapter.vue'))
}

