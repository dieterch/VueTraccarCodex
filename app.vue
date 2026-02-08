<script setup>
import { ref } from 'vue'
import { useTraccar } from '~/composables/useTraccar'
import { useMapData } from '~/composables/useMapData'

// Note: Authentication is disabled (SSO forward-auth mode)
// If you need password authentication, uncomment below and set hash
// import { hashPassword } from '~/utils/crypto'
// const vueTraccarHash = hashPassword('your-password')
const vueTraccarHash = '';

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

// Authentication
// Set to true to skip authentication (SSO forward-auth implemented)
const authenticated = ref(true)
</script>

<template>
  <v-app class="rounded rounded-md">
    <div v-if="!authenticated">
      <Login
        :hash="vueTraccarHash"
        :authenticated="authenticated"
        @authenticated="(e) => { authenticated = e }"
      />
    </div>
    <div v-else>
      <AppBar />
      <v-main>
        <DebugDialog />
        <SettingsDialog />
        <AboutDialog />
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
