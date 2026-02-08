<script setup>
import { useMapData } from '~/composables/useMapData'

const { aboutdialog } = useMapData()

// App information
const appName = 'VueTraccarCodex'
const version = '1.0.2'
const lastCommitDate = '2026-02-08'

const features = [
  'Real-time GPS tracking visualization',
  'Interactive map with route playback',
  'Travel history management',
  'Standstill detection and analysis',
  'Manual POI creation (Cmd/Ctrl+Click)',
  'POI Mode for independent markers',
  'KML export functionality',
  'Multi-device support',
  'SQLite-based route caching',
  'Event tracking and filtering',
  'Responsive design with Vuetify'
]

const scripts = [
  'Export/Import timing adjustments',
  'Export/Import travel patches',
  'Export/Import manual POIs',
  'Data backup and restore',
  'Instance-to-instance migration'
]
</script>

<template>
  <v-dialog
    v-model="aboutdialog"
    max-width="600"
  >
    <v-card
      class="bg-surface"
      style="opacity: 0.95;"
    >
      <v-card-title class="text-h5 pa-4 bg-grey-darken-3">
        <v-icon icon="mdi-information" class="mr-2"></v-icon>
        About {{ appName }}
      </v-card-title>

      <v-card-text class="pa-4">
        <v-container fluid>
          <v-row class="mb-2">
            <v-col cols="12">
              <div class="text-h6 mb-2">{{ appName }}</div>
              <div class="text-body-2 text-grey">Version {{ version }}</div>
              <div class="text-body-2 text-grey">Last updated: {{ lastCommitDate }}</div>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <div class="text-subtitle-1 font-weight-bold mb-3">
                Key Features
              </div>
              <v-list density="compact" class="bg-transparent">
                <v-list-item
                  v-for="(feature, index) in features"
                  :key="index"
                  class="px-0"
                >
                  <template v-slot:prepend>
                    <v-icon icon="mdi-check-circle" color="green" size="small" class="mr-2"></v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">{{ feature }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <div class="text-subtitle-1 font-weight-bold mb-3">
                Data Management Scripts
              </div>
              <v-list density="compact" class="bg-transparent">
                <v-list-item
                  v-for="(script, index) in scripts"
                  :key="index"
                  class="px-0"
                >
                  <template v-slot:prepend>
                    <v-icon icon="mdi-console" color="blue" size="small" class="mr-2"></v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">{{ script }}</v-list-item-title>
                </v-list-item>
              </v-list>
              <div class="text-caption text-grey mt-2">
                See /scripts/README.md for usage details
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12" class="text-center text-body-2 text-grey">
              Built with Vue 3, Nuxt 4 & Vuetify 3
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          variant="elevated"
          @click="aboutdialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
