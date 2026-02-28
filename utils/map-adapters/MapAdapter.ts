import type { Component } from 'vue'

export type MapProviderId = 'google' | 'osm'

export interface MapAdapter {
  id: MapProviderId
  label: string
  component: Component
}

