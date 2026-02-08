<script setup>
import { ref, watch } from 'vue'
import { useMapData } from '~/composables/useMapData'

const { configdialog } = useMapData()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Available options from API
const geofences = ref([])
const devices = ref([])

// Form data
const settings = ref({
  // Traccar API
  traccarUrl: '',
  traccarUser: '',
  traccarPassword: '',
  traccarDeviceId: null,
  traccarDeviceName: '',

  // Google Maps
  googleMapsApiKey: '',
  googleMapsMapId: '',

  // WordPress
  wordpressUrl: '',
  wordpressUser: '',
  wordpressAppPassword: '',
  wordpressCacheDuration: 3600,

  // Application
  vueTraccarPassword: '',
  settingsPassword: '',
  homeMode: false,
  homeLatitude: '',
  homeLongitude: '',

  // Home Geofence
  homeGeofenceId: null,
  homeGeofenceName: '',

  // Route Analysis
  eventMinGap: 60,
  maxDays: 170,
  minDays: 2,
  standPeriod: 12,
  startDate: '',

  // Side Trip Tracking
  sideTripEnabled: false,
  sideTripDevices: [],
  sideTripBufferHours: 6
})

// Expansion panel state
const expandedPanels = ref([0])

// Travel Patches Management
const travelPatches = ref([])
const loadingPatches = ref(false)
const editingPatch = ref(null)
const newPatch = ref({
  addressKey: '',
  title: '',
  fromDate: '',
  toDate: '',
  exclude: false
})
const showAddPatchForm = ref(false)
const migratingYaml = ref(false)

// Side Trip Device Management
const editingSideTripDevice = ref(null)
const showAddDeviceForm = ref(false)
const newSideTripDevice = ref({
  deviceId: null,
  deviceName: '',
  color: '#0088FF',
  lineWeight: 2,
  enabled: true
})

// Default color palette
const defaultColors = ['#0088FF', '#00CC44', '#9933FF', '#FF6600', '#FFD700', '#FF1493']

// Load current settings and available options
async function loadSettings() {
  loading.value = true
  errorMessage.value = ''

  try {
    // Load current settings
    const settingsResponse = await $fetch('/api/settings')
    if (settingsResponse.success) {
      settings.value = { ...settingsResponse.settings }
    }

    // Load available devices
    const devicesResponse = await $fetch('/api/devices')
    if (devicesResponse.success) {
      devices.value = devicesResponse.devices
    }

    // Load available geofences
    const geofencesResponse = await $fetch('/api/geofences')
    if (geofencesResponse.success) {
      geofences.value = geofencesResponse.geofences
    }

    // Load travel patches
    await loadTravelPatches()
  } catch (error) {
    console.error('Error loading settings:', error)
    errorMessage.value = 'Failed to load settings. Please try again.'
  } finally {
    loading.value = false
  }
}

// Save settings
async function saveSettings() {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = { ...settings.value }
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' && value.trim() === '') {
        delete payload[key]
      }
    }
    const response = await $fetch('/api/settings', {
      method: 'POST',
      body: payload
    })

    if (response.success) {
      successMessage.value = 'Settings saved successfully! Please restart the application for changes to take effect.'
    }
  } catch (error) {
    console.error('Error saving settings:', error)
    errorMessage.value = 'Failed to save settings. Please try again.'
  } finally {
    saving.value = false
  }
}

// Update device name when device is selected
function onDeviceSelected(id) {
  const device = devices.value.find(d => d.id === id)
  if (device) {
    settings.value.traccarDeviceName = device.name
  }
}

// Update geofence name when geofence is selected
function onGeofenceSelected(id) {
  const geofence = geofences.value.find(g => g.id === id)
  if (geofence) {
    settings.value.homeGeofenceName = geofence.name
  }
}

// Load travel patches
async function loadTravelPatches() {
  loadingPatches.value = true
  try {
    const response = await $fetch('/api/travel-patches')
    if (response.success) {
      travelPatches.value = response.patches.map(p => ({
        addressKey: p.address_key,
        title: p.title || '',
        fromDate: p.from_date || '',
        toDate: p.to_date || '',
        exclude: Boolean(p.exclude),
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
    }
  } catch (error) {
    console.error('Error loading travel patches:', error)
    errorMessage.value = 'Failed to load travel patches'
  } finally {
    loadingPatches.value = false
  }
}

// Edit travel patch
function editPatch(patch) {
  newPatch.value = {
    addressKey: patch.addressKey,
    title: patch.title,
    fromDate: patch.fromDate,
    toDate: patch.toDate,
    exclude: patch.exclude
  }
  editingPatch.value = patch.addressKey
  showAddPatchForm.value = true
}

// Cancel editing
function cancelEdit() {
  editingPatch.value = null
  showAddPatchForm.value = false
  newPatch.value = { addressKey: '', title: '', fromDate: '', toDate: '', exclude: false }
}

// Save travel patch
async function saveTravelPatch(patch) {
  try {
    await $fetch('/api/travel-patches', {
      method: 'POST',
      body: patch
    })
    await loadTravelPatches()
    successMessage.value = editingPatch.value
      ? 'Travel patch updated successfully'
      : 'Travel patch saved successfully'
    editingPatch.value = null
    showAddPatchForm.value = false
    newPatch.value = { addressKey: '', title: '', fromDate: '', toDate: '', exclude: false }
  } catch (error) {
    console.error('Error saving travel patch:', error)
    errorMessage.value = 'Failed to save travel patch'
  }
}

// Delete travel patch
async function deleteTravelPatch(addressKey) {
  if (!confirm(`Delete travel patch for "${addressKey}"?`)) return

  try {
    await $fetch(`/api/travel-patches/${encodeURIComponent(addressKey)}`, {
      method: 'DELETE'
    })
    await loadTravelPatches()
    successMessage.value = 'Travel patch deleted successfully'
  } catch (error) {
    console.error('Error deleting travel patch:', error)
    errorMessage.value = 'Failed to delete travel patch'
  }
}

// Migrate from YAML
async function migrateFromYaml() {
  if (!confirm('Migrate travel patches from travels.yml to database? Existing patches will be updated.')) return

  migratingYaml.value = true
  try {
    const response = await $fetch('/api/travel-patches/migrate', {
      method: 'POST'
    })
    successMessage.value = response.message
    await loadTravelPatches()
  } catch (error) {
    console.error('Error migrating from YAML:', error)
    errorMessage.value = 'Failed to migrate from YAML'
  } finally {
    migratingYaml.value = false
  }
}

// Add side trip device
function addSideTripDevice() {
  if (!newSideTripDevice.value.deviceId || !newSideTripDevice.value.deviceName) {
    errorMessage.value = 'Please select a device'
    return
  }

  // Check if device already exists
  const exists = settings.value.sideTripDevices.some(
    d => d.deviceId === newSideTripDevice.value.deviceId
  )

  if (exists) {
    errorMessage.value = 'This device is already added'
    return
  }

  // Check if it's the main device
  if (newSideTripDevice.value.deviceId === settings.value.traccarDeviceId) {
    errorMessage.value = 'Cannot add the main device as a side trip device'
    return
  }

  settings.value.sideTripDevices.push({ ...newSideTripDevice.value })

  // Reset form
  newSideTripDevice.value = {
    deviceId: null,
    deviceName: '',
    color: defaultColors[settings.value.sideTripDevices.length % defaultColors.length],
    lineWeight: 2,
    enabled: true
  }
  showAddDeviceForm.value = false
  successMessage.value = 'Device added successfully'
}

// Edit side trip device
function editSideTripDevice(device) {
  newSideTripDevice.value = { ...device }
  editingSideTripDevice.value = device.deviceId
  showAddDeviceForm.value = true
}

// Update side trip device
function updateSideTripDevice() {
  const index = settings.value.sideTripDevices.findIndex(
    d => d.deviceId === editingSideTripDevice.value
  )

  if (index !== -1) {
    settings.value.sideTripDevices[index] = { ...newSideTripDevice.value }
    successMessage.value = 'Device updated successfully'
  }

  cancelEditSideTripDevice()
}

// Cancel editing side trip device
function cancelEditSideTripDevice() {
  editingSideTripDevice.value = null
  showAddDeviceForm.value = false
  newSideTripDevice.value = {
    deviceId: null,
    deviceName: '',
    color: defaultColors[settings.value.sideTripDevices.length % defaultColors.length],
    lineWeight: 2,
    enabled: true
  }
}

// Delete side trip device
function deleteSideTripDevice(deviceId) {
  if (!confirm('Delete this side trip device?')) return

  settings.value.sideTripDevices = settings.value.sideTripDevices.filter(
    d => d.deviceId !== deviceId
  )
  successMessage.value = 'Device deleted successfully'
}

// On side trip device selected
function onSideTripDeviceSelected(id) {
  const device = devices.value.find(d => d.id === id)
  if (device) {
    newSideTripDevice.value.deviceName = device.name
  }
}

// Watch for dialog open
watch(() => configdialog.value, async (isOpen) => {
  if (isOpen) {
    successMessage.value = ''
    errorMessage.value = ''
    await loadSettings()
  } else {
    successMessage.value = ''
    errorMessage.value = ''
  }
})
</script>

<template>
  <v-dialog
    v-model="configdialog"
    max-width="800"
    scrollable
  >
    <v-card
      class="bg-surface"
      style="opacity: 0.95;"
    >
      <v-card-title class="text-h5 pa-4 bg-grey-darken-3 sticky-top">
        <v-icon icon="mdi-cog" class="mr-2"></v-icon>
        Application Settings
      </v-card-title>

      <v-card-text class="pa-4" style="max-height: 70vh;">
        <v-container fluid>
          <!-- Loading State -->
          <v-row v-if="loading">
            <v-col cols="12" class="text-center">
              <v-progress-circular
                indeterminate
                color="primary"
              ></v-progress-circular>
              <div class="mt-2">Loading settings...</div>
            </v-col>
          </v-row>

          <!-- Settings Form -->
          <div v-else>
            <!-- Error Message -->
            <v-row v-if="errorMessage">
              <v-col cols="12">
                <v-alert
                  type="error"
                  variant="tonal"
                  density="compact"
                  closable
                  @click:close="errorMessage = ''"
                >
                  {{ errorMessage }}
                </v-alert>
              </v-col>
            </v-row>

            <!-- Success Message -->
            <v-row v-if="successMessage">
              <v-col cols="12">
                <v-alert
                  type="success"
                  variant="tonal"
                  density="compact"
                  closable
                  @click:close="successMessage = ''"
                >
                  {{ successMessage }}
                </v-alert>
              </v-col>
            </v-row>

            <!-- Settings Sections -->
            <v-expansion-panels v-model="expandedPanels" multiple>
              <!-- 1. Traccar API Settings -->
              <v-expansion-panel value="0">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-api" class="mr-2"></v-icon>
                  Traccar API Configuration
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model="settings.traccarUrl"
                    label="Traccar URL"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-web"
                    hint="Base URL of your Traccar server"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.traccarUser"
                    label="Traccar User"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-account"
                    hint="Username or email for Traccar login"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.traccarPassword"
                    label="Traccar Password"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-lock"
                    hint="Password for Traccar login"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-select
                    v-model="settings.traccarDeviceId"
                    :items="devices"
                    item-title="name"
                    item-value="id"
                    label="Traccar Device"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-cellphone-link"
                    @update:model-value="onDeviceSelected"
                    hint="Select the device to track"
                    persistent-hint
                  >
                    <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template v-slot:prepend>
                          <v-icon icon="mdi-cellphone-link" class="mr-2"></v-icon>
                        </template>
                        <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                        <v-list-item-subtitle>ID: {{ item.raw.id }} | Status: {{ item.raw.status }}</v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 2. Google Maps Settings -->
              <v-expansion-panel value="1">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-google-maps" class="mr-2"></v-icon>
                  Google Maps Configuration
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model="settings.googleMapsApiKey"
                    label="Google Maps API Key"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-key"
                    hint="API key for Google Maps"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.googleMapsMapId"
                    label="Google Maps Map ID"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-map"
                    hint="Map ID for Vector Maps and Advanced Markers"
                    persistent-hint
                  ></v-text-field>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 3. WordPress Settings -->
              <v-expansion-panel value="2">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-wordpress" class="mr-2"></v-icon>
                  WordPress Integration
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model="settings.wordpressUrl"
                    label="WordPress URL"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-web"
                    hint="Base URL of your WordPress site"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.wordpressUser"
                    label="WordPress User"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-account"
                    hint="WordPress username"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.wordpressAppPassword"
                    label="WordPress Application Password"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-lock"
                    hint="App password for WordPress"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model.number="settings.wordpressCacheDuration"
                    label="Cache Duration (seconds)"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    prepend-inner-icon="mdi-timer-sand"
                    hint="How long to cache WordPress data"
                    persistent-hint
                  ></v-text-field>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 4. Application Settings -->
              <v-expansion-panel value="3">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-application-cog" class="mr-2"></v-icon>
                  Application Settings
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model="settings.vueTraccarPassword"
                    label="App Access Password"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-lock"
                    hint="Password for app access"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-switch
                    v-model="settings.homeMode"
                    label="Home Mode"
                    color="primary"
                    hint="Enable home mode features"
                    persistent-hint
                    class="mb-3"
                  ></v-switch>

                  <v-text-field
                    v-model="settings.homeLatitude"
                    label="Home Latitude"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-latitude"
                    hint="Latitude of home location"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.homeLongitude"
                    label="Home Longitude"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-longitude"
                    hint="Longitude of home location"
                    persistent-hint
                  ></v-text-field>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 5. Home Geofence Settings -->
              <v-expansion-panel value="4">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-map-marker-radius" class="mr-2"></v-icon>
                  Home Geofence
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="text-body-2 text-grey mb-4">
                    Select the geofence that represents your home base. This is used to determine when travels start and end.
                  </div>

                  <v-select
                    v-model="settings.homeGeofenceId"
                    :items="geofences"
                    item-title="name"
                    item-value="id"
                    label="Home Geofence"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-map-marker"
                    @update:model-value="onGeofenceSelected"
                    hint="Geofence marking your home location"
                    persistent-hint
                  >
                    <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template v-slot:prepend>
                          <v-icon icon="mdi-map-marker" class="mr-2"></v-icon>
                        </template>
                        <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                        <v-list-item-subtitle>ID: {{ item.raw.id }}</v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>

                  <v-alert
                    v-if="settings.homeGeofenceId"
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                  >
                    <div class="text-body-2">
                      <strong>Selected:</strong> {{ settings.homeGeofenceName }} (ID: {{ settings.homeGeofenceId }})
                    </div>
                  </v-alert>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 6. Route Analysis Settings -->
              <v-expansion-panel value="5">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-map-search" class="mr-2"></v-icon>
                  Route Analysis Parameters
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-text-field
                    v-model.number="settings.eventMinGap"
                    label="Event Min Gap (seconds)"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    prepend-inner-icon="mdi-timer"
                    hint="Minimum time gap between events"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model.number="settings.minDays"
                    label="Min Travel Days"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    prepend-inner-icon="mdi-calendar-range"
                    hint="Minimum days for a trip to be considered"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model.number="settings.maxDays"
                    label="Max Travel Days"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    prepend-inner-icon="mdi-calendar-range"
                    hint="Maximum days for a trip to be considered"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model.number="settings.standPeriod"
                    label="Standstill Period (hours)"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    prepend-inner-icon="mdi-clock"
                    hint="Minimum hours to detect a standstill"
                    persistent-hint
                    class="mb-3"
                  ></v-text-field>

                  <v-text-field
                    v-model="settings.startDate"
                    label="Analysis Start Date"
                    variant="outlined"
                    density="comfortable"
                    type="datetime-local"
                    prepend-inner-icon="mdi-calendar-start"
                    hint="Starting date for route analysis (ISO format)"
                    persistent-hint
                  ></v-text-field>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 7. Travel Patches Management -->
              <v-expansion-panel value="6">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-map-marker-path" class="mr-2"></v-icon>
                  Travel Patches Management
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="text-body-2 text-grey mb-4">
                    Manage custom titles and date overrides for detected travels. Each patch is matched by the travel's farthest destination address.
                  </div>

                  <!-- Migration Button -->
                  <v-alert
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="mb-4"
                  >
                    <div class="d-flex align-center justify-space-between">
                      <div>
                        <strong>First time setup?</strong> Migrate existing travels.yml to database
                      </div>
                      <v-btn
                        size="small"
                        variant="elevated"
                        color="primary"
                        @click="migrateFromYaml"
                        :loading="migratingYaml"
                      >
                        <v-icon icon="mdi-database-import" class="mr-1"></v-icon>
                        Migrate from YAML
                      </v-btn>
                    </div>
                  </v-alert>

                  <!-- Add New Patch Button -->
                  <v-btn
                    variant="outlined"
                    color="primary"
                    class="mb-4"
                    @click="showAddPatchForm = !showAddPatchForm"
                    v-if="!showAddPatchForm"
                  >
                    <v-icon icon="mdi-plus" class="mr-2"></v-icon>
                    Add New Travel Patch
                  </v-btn>

                  <!-- Add/Edit Patch Form -->
                  <v-card v-if="showAddPatchForm" variant="outlined" class="mb-4">
                    <v-card-title class="bg-grey-darken-3">
                      <v-icon :icon="editingPatch ? 'mdi-pencil' : 'mdi-plus'" class="mr-2"></v-icon>
                      {{ editingPatch ? 'Edit Travel Patch' : 'Add New Travel Patch' }}
                    </v-card-title>
                    <v-card-text>
                      <v-text-field
                        v-model="newPatch.addressKey"
                        label="Address Key"
                        variant="outlined"
                        density="comfortable"
                        hint="The destination address to match (e.g., 'Krk, Croatia')"
                        persistent-hint
                        class="mb-3"
                        :readonly="!!editingPatch"
                      ></v-text-field>

                      <v-text-field
                        v-model="newPatch.title"
                        label="Custom Title"
                        variant="outlined"
                        density="comfortable"
                        hint="Custom title for this travel"
                        persistent-hint
                        class="mb-3"
                      ></v-text-field>

                      <v-text-field
                        v-model="newPatch.fromDate"
                        label="Override From Date"
                        variant="outlined"
                        density="comfortable"
                        type="date"
                        hint="Optional: Override travel start date"
                        persistent-hint
                        class="mb-3"
                      ></v-text-field>

                      <v-text-field
                        v-model="newPatch.toDate"
                        label="Override To Date"
                        variant="outlined"
                        density="comfortable"
                        type="date"
                        hint="Optional: Override travel end date"
                        persistent-hint
                        class="mb-3"
                      ></v-text-field>

                      <v-checkbox
                        v-model="newPatch.exclude"
                        label="Exclude this travel"
                        color="error"
                        hint="Check to exclude this destination from travel detection"
                        persistent-hint
                      ></v-checkbox>
                    </v-card-text>
                    <v-card-actions>
                      <v-spacer></v-spacer>
                      <v-btn variant="text" @click="cancelEdit">Cancel</v-btn>
                      <v-btn
                        color="primary"
                        variant="elevated"
                        @click="saveTravelPatch(newPatch)"
                        :disabled="!newPatch.addressKey"
                      >
                        <v-icon icon="mdi-content-save" class="mr-2"></v-icon>
                        {{ editingPatch ? 'Update' : 'Save' }}
                      </v-btn>
                    </v-card-actions>
                  </v-card>

                  <!-- Patches List -->
                  <div v-if="loadingPatches" class="text-center py-4">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    <div class="mt-2">Loading travel patches...</div>
                  </div>

                  <div v-else-if="travelPatches.length === 0" class="text-center py-4 text-grey">
                    No travel patches configured yet. Add one above or migrate from YAML.
                  </div>

                  <v-list v-else density="compact">
                    <v-list-item
                      v-for="patch in travelPatches"
                      :key="patch.addressKey"
                      class="mb-2"
                      border
                    >
                      <template v-slot:prepend>
                        <v-icon
                          :icon="patch.exclude ? 'mdi-close-circle' : 'mdi-map-marker'"
                          :color="patch.exclude ? 'error' : 'primary'"
                        ></v-icon>
                      </template>

                      <v-list-item-title class="font-weight-medium">
                        {{ patch.addressKey }}
                      </v-list-item-title>

                      <v-list-item-subtitle v-if="patch.title">
                        {{ patch.title }}
                      </v-list-item-subtitle>

                      <v-list-item-subtitle v-if="patch.fromDate || patch.toDate">
                        <v-icon icon="mdi-calendar-range" size="small" class="mr-1"></v-icon>
                        {{ patch.fromDate || '—' }} to {{ patch.toDate || '—' }}
                      </v-list-item-subtitle>

                      <template v-slot:append>
                        <v-btn
                          icon="mdi-pencil"
                          variant="text"
                          size="small"
                          color="primary"
                          @click="editPatch(patch)"
                          class="mr-1"
                        ></v-btn>
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          size="small"
                          color="error"
                          @click="deleteTravelPatch(patch.addressKey)"
                        ></v-btn>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- 8. Side Trip Tracking -->
              <v-expansion-panel value="7">
                <v-expansion-panel-title>
                  <v-icon icon="mdi-map-marker-multiple" class="mr-2"></v-icon>
                  Side Trip Tracking
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="text-body-2 text-grey mb-4">
                    Track and visualize side trips (bicycle tours, town visits) from secondary devices during camper standstill periods. Routes display only when the main vehicle is parked for extended periods. Use the +/- time adjustment buttons on each standstill marker to fine-tune the tracking period.
                  </div>

                  <!-- Enable/Disable Side Trip Tracking -->
                  <v-switch
                    v-model="settings.sideTripEnabled"
                    label="Enable Side Trip Tracking"
                    color="primary"
                    hint="Show routes from secondary devices during standstills"
                    persistent-hint
                    class="mb-4"
                  ></v-switch>

                  <div v-if="settings.sideTripEnabled">
                    <!-- Add Device Button -->
                    <v-btn
                      variant="outlined"
                      color="primary"
                      class="mb-4"
                      @click="showAddDeviceForm = !showAddDeviceForm"
                      v-if="!showAddDeviceForm"
                    >
                      <v-icon icon="mdi-plus" class="mr-2"></v-icon>
                      Add Secondary Device
                    </v-btn>

                    <!-- Add/Edit Device Form -->
                    <v-card v-if="showAddDeviceForm" variant="outlined" class="mb-4">
                      <v-card-title class="bg-grey-darken-3">
                        <v-icon :icon="editingSideTripDevice ? 'mdi-pencil' : 'mdi-plus'" class="mr-2"></v-icon>
                        {{ editingSideTripDevice ? 'Edit Secondary Device' : 'Add Secondary Device' }}
                      </v-card-title>
                      <v-card-text>
                        <v-select
                          v-model="newSideTripDevice.deviceId"
                          :items="devices.filter(d => d.id !== settings.traccarDeviceId)"
                          item-title="name"
                          item-value="id"
                          label="Select Device"
                          variant="outlined"
                          density="comfortable"
                          prepend-inner-icon="mdi-cellphone-link"
                          @update:model-value="onSideTripDeviceSelected"
                          hint="Select a secondary device to track"
                          persistent-hint
                          class="mb-3"
                          :readonly="!!editingSideTripDevice"
                        >
                          <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props">
                              <template v-slot:prepend>
                                <v-icon icon="mdi-cellphone-link" class="mr-2"></v-icon>
                              </template>
                              <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                              <v-list-item-subtitle>ID: {{ item.raw.id }}</v-list-item-subtitle>
                            </v-list-item>
                          </template>
                        </v-select>

                        <v-text-field
                          v-model="newSideTripDevice.color"
                          label="Route Color"
                          variant="outlined"
                          density="comfortable"
                          type="color"
                          prepend-inner-icon="mdi-palette"
                          hint="Color for this device's route"
                          persistent-hint
                          class="mb-3"
                        ></v-text-field>

                        <v-slider
                          v-model="newSideTripDevice.lineWeight"
                          label="Line Weight"
                          min="1"
                          max="5"
                          step="1"
                          thumb-label
                          hint="Thickness of the route line"
                          persistent-hint
                          class="mb-3"
                        ></v-slider>

                        <v-switch
                          v-model="newSideTripDevice.enabled"
                          label="Enabled"
                          color="primary"
                          hint="Show this device's routes on the map"
                          persistent-hint
                        ></v-switch>
                      </v-card-text>
                      <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn variant="text" @click="cancelEditSideTripDevice">Cancel</v-btn>
                        <v-btn
                          color="primary"
                          variant="elevated"
                          @click="editingSideTripDevice ? updateSideTripDevice() : addSideTripDevice()"
                          :disabled="!newSideTripDevice.deviceId"
                        >
                          <v-icon icon="mdi-content-save" class="mr-2"></v-icon>
                          {{ editingSideTripDevice ? 'Update' : 'Add' }}
                        </v-btn>
                      </v-card-actions>
                    </v-card>

                    <!-- Devices List -->
                    <div v-if="settings.sideTripDevices.length === 0" class="text-center py-4 text-grey">
                      No secondary devices configured yet. Add one above.
                    </div>

                    <v-list v-else density="compact">
                      <v-list-item
                        v-for="device in settings.sideTripDevices"
                        :key="device.deviceId"
                        class="mb-2"
                        border
                      >
                        <template v-slot:prepend>
                          <div
                            :style="{
                              width: '24px',
                              height: '24px',
                              backgroundColor: device.color,
                              borderRadius: '4px',
                              marginRight: '8px'
                            }"
                          ></div>
                        </template>

                        <v-list-item-title class="font-weight-medium">
                          {{ device.deviceName }}
                          <v-chip v-if="!device.enabled" size="x-small" color="grey" class="ml-2">Disabled</v-chip>
                        </v-list-item-title>

                        <v-list-item-subtitle>
                          Device ID: {{ device.deviceId }} | Line Weight: {{ device.lineWeight }}px
                        </v-list-item-subtitle>

                        <template v-slot:append>
                          <v-btn
                            icon="mdi-pencil"
                            variant="text"
                            size="small"
                            color="primary"
                            @click="editSideTripDevice(device)"
                            class="mr-1"
                          ></v-btn>
                          <v-btn
                            icon="mdi-delete"
                            variant="text"
                            size="small"
                            color="error"
                            @click="deleteSideTripDevice(device.deviceId)"
                          ></v-btn>
                        </template>
                      </v-list-item>
                    </v-list>

                    <!-- Info Alert -->
                    <v-alert
                      type="info"
                      variant="tonal"
                      density="compact"
                      class="mt-4"
                    >
                      <div class="text-body-2">
                        <strong>How it works:</strong> Secondary device routes will only appear on the map during main vehicle standstill periods ({{ settings.standPeriod }}+ hours). Use the +/- time adjustment buttons in each standstill's info window to fine-tune the period if needed. Perfect for tracking bicycle tours or town visits while camping!
                      </div>
                    </v-alert>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-container>
      </v-card-text>

      <v-card-actions class="pa-4 bg-grey-darken-4">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="configdialog = false"
          :disabled="saving"
        >
          Close
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          @click="saveSettings"
          :loading="saving"
          :disabled="loading"
        >
          <v-icon icon="mdi-content-save" class="mr-2"></v-icon>
          Save All Settings
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 1;
}
</style>
