<script setup>
import { onMounted } from 'vue'
import { useTraccar } from '~/composables/useTraccar'
import { useMapData } from '~/composables/useMapData'
import { useAuth } from '~/composables/useAuth'

const { authState, authReady, authError, bootstrapAuth } = useAuth()

const {
  startdate,
  stopdate,
  travel,
  travels,
  route,
  events
} = useTraccar()

const {
  polygone,
  togglemap,
  toggletravels,
  toggleroute,
  toggleEvents
} = useMapData()

onMounted(async () => {
  await bootstrapAuth()
})
</script>

<template>
  <v-app class="rounded rounded-md">
    <div v-if="!authReady" class="d-flex align-center justify-center" style="height: 100vh">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>
    <div v-else-if="!authState.authenticated" class="d-flex align-center justify-center" style="height: 100vh">
      <v-sheet width="480" class="mx-auto pa-6 text-center">
        <v-icon icon="mdi-shield-alert" size="64" color="error"></v-icon>
        <div class="text-h6 mt-4">Authentication Failed</div>
        <div class="text-body-2 text-grey mt-2">
          {{ authError || 'No valid authentication headers received.' }}
        </div>
      </v-sheet>
    </div>
    <div v-else>
      <AppBar />
      <v-main>
        <DebugDialog />
        <SettingsDialog />
        <AboutDialog />
        <ManualTravelEditor />
        <GMap v-if="togglemap" :key="polygone" />
        <pre v-if="toggletravels">
Reise {{ travel }}
        </pre>
        <pre v-if="toggleroute">
Route {{ route }}
        </pre>
        <pre v-if="toggleEvents">
Events {{ events }}
        </pre>
      </v-main>
    </div>
  </v-app>
</template>
