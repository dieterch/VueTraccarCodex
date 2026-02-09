<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { GoogleMap, Polyline, Polygon, Marker } from 'vue3-google-map'
import { useMapData } from '~/composables/useMapData'
import { useTraccar } from '~/composables/useTraccar'
import type { TraccarDevice } from '~/types/traccar'

type ManualPoint = {
  id: string
  fixTime: string
  latitude: number
  longitude: number
  speed?: number
  altitude?: number
  attributes?: Record<string, any>
}

const config = useRuntimeConfig()
const mapsApiKey = config.public.googleMapsApiKey
const mapsMapId = config.public.googleMapsMapId

const { manualtraveldialog } = useMapData()
const { getDevices, getTravels, device } = useTraccar()

const devices = ref<TraccarDevice[]>([])
const selectedDeviceId = ref<number | null>(null)
const manualTravels = ref<any[]>([])
const editingTravelId = ref<string | null>(null)

const fromInput = ref<string>('2019-05-05T00:00')
const toInput = ref<string>(new Date().toISOString().slice(0, 16))

const rawPoints = ref<ManualPoint[]>([])
const currentPoints = ref<ManualPoint[]>([])
const selectedPointIds = ref<string[]>([])

const title = ref<string>('')
const notes = ref<string>('')

const lassoMode = ref(false)
const lassoPath = ref<Array<{ lat: number; lng: number }>>([])

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const history = ref<ManualPoint[][]>([])
const historyIndex = ref<number>(-1)

watch(manualtraveldialog, async (isOpen) => {
  if (!isOpen) return
  await loadDevices()
  await loadManualTravels()
  if (!selectedDeviceId.value && device.value?.id) {
    selectedDeviceId.value = device.value.id
  }
})

function clonePoints(points: ManualPoint[]) {
  return points.map(p => ({ ...p }))
}

function resetHistory(points: ManualPoint[]) {
  history.value = [clonePoints(points)]
  historyIndex.value = points.length ? 0 : -1
}

function pushHistory(points: ManualPoint[]) {
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  history.value.push(clonePoints(points))
  historyIndex.value = history.value.length - 1
}

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const selectedCount = computed(() => selectedPointIds.value.length)
const pointsCount = computed(() => currentPoints.value.length)

const mapCenter = computed(() => {
  if (currentPoints.value.length === 0) return { lat: 0, lng: 0 }
  const mid = currentPoints.value[Math.floor(currentPoints.value.length / 2)]
  return { lat: mid.latitude, lng: mid.longitude }
})

const polylinePath = computed(() => currentPoints.value.map(p => ({ lat: p.latitude, lng: p.longitude })))

const selectedMarkers = computed(() => {
  const selectedSet = new Set(selectedPointIds.value)
  const markers = currentPoints.value.filter(p => selectedSet.has(p.id))
  return markers.slice(0, 500)
})

async function loadDevices() {
  try {
    devices.value = await getDevices()
  } catch (err: any) {
    console.error('Failed to load devices:', err)
  }
}

async function loadManualTravels() {
  try {
    manualTravels.value = await $fetch<any[]>('/api/manual-travels')
  } catch (err: any) {
    console.error('Failed to load manual travels:', err)
  }
}

function parseInputDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatTravelDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).format(date)
}

async function loadPoints() {
  error.value = null
  editingTravelId.value = null
  const fromDate = parseInputDate(fromInput.value)
  const toDate = parseInputDate(toInput.value)

  if (!selectedDeviceId.value || !fromDate || !toDate) {
    error.value = 'Bitte Gerät und Zeitraum auswählen.'
    return
  }

  loading.value = true
  try {
    const route = await $fetch<any[]>('/api/manual-route', {
      method: 'POST',
      body: {
        deviceId: selectedDeviceId.value,
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      }
    })

    const points: ManualPoint[] = route.map(pos => ({
      id: String(pos.id),
      fixTime: pos.fixTime,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      altitude: pos.altitude,
      attributes: pos.attributes || {}
    }))

    rawPoints.value = points
    currentPoints.value = clonePoints(points)
    selectedPointIds.value = []
    lassoPath.value = []
    resetHistory(points)
  } catch (err: any) {
    console.error('Failed to load points:', err)
    error.value = 'Fehler beim Laden der Positionsdaten.'
  } finally {
    loading.value = false
  }
}

async function loadManualTravel(item: any) {
  if (!item?.id) return
  error.value = null
  loading.value = true
  try {
    const positions = await $fetch<any[]>(`/api/manual-travels/${item.id}/positions`)
    const points: ManualPoint[] = positions.map(pos => ({
      id: String(pos.id),
      fixTime: pos.fix_time || pos.fixTime,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      altitude: pos.altitude,
      attributes: pos.attributes || {}
    }))

    editingTravelId.value = String(item.id)
    title.value = item.title || ''
    notes.value = item.notes || ''
    selectedDeviceId.value = Number(item.source_device_id || item.sourceDeviceId || selectedDeviceId.value)
    fromInput.value = item.from_date ? item.from_date.slice(0, 16) : fromInput.value
    toInput.value = item.to_date ? item.to_date.slice(0, 16) : toInput.value

    rawPoints.value = points
    currentPoints.value = clonePoints(points)
    selectedPointIds.value = []
    lassoPath.value = []
    resetHistory(points)
  } catch (err: any) {
    console.error('Failed to load manual travel:', err)
    error.value = 'Fehler beim Laden der manuellen Reise.'
  } finally {
    loading.value = false
  }
}

function onMapClick(event: any) {
  if (!lassoMode.value || !event?.latLng) return
  lassoPath.value = [
    ...lassoPath.value,
    { lat: event.latLng.lat(), lng: event.latLng.lng() }
  ]
}

function clearLasso() {
  lassoPath.value = []
  selectedPointIds.value = []
}

function applyLassoSelection() {
  if (lassoPath.value.length < 3) return
  const selected = currentPoints.value
    .filter(p => isPointInPolygon({ lat: p.latitude, lng: p.longitude }, lassoPath.value))
    .map(p => p.id)
  selectedPointIds.value = selected
}

function deleteSelection() {
  if (selectedPointIds.value.length === 0) return
  const selectedSet = new Set(selectedPointIds.value)
  const next = currentPoints.value.filter(p => !selectedSet.has(p.id))
  currentPoints.value = clonePoints(next)
  selectedPointIds.value = []
  pushHistory(currentPoints.value)
}

function keepSelection() {
  if (selectedPointIds.value.length === 0) return
  const selectedSet = new Set(selectedPointIds.value)
  const next = currentPoints.value.filter(p => selectedSet.has(p.id))
  currentPoints.value = clonePoints(next)
  selectedPointIds.value = []
  pushHistory(currentPoints.value)
}

function resetWorkspace() {
  currentPoints.value = clonePoints(rawPoints.value)
  selectedPointIds.value = []
  lassoPath.value = []
  resetHistory(currentPoints.value)
}

function undo() {
  if (!canUndo.value) return
  historyIndex.value -= 1
  currentPoints.value = clonePoints(history.value[historyIndex.value])
  selectedPointIds.value = []
}

function redo() {
  if (!canRedo.value) return
  historyIndex.value += 1
  currentPoints.value = clonePoints(history.value[historyIndex.value])
  selectedPointIds.value = []
}

function getMinMaxTimes(points: ManualPoint[]) {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime())
  return { from: sorted[0].fixTime, to: sorted[sorted.length - 1].fixTime }
}

async function saveTravel() {
  if (currentPoints.value.length === 0) {
    error.value = 'Keine Punkte zum Speichern.'
    return
  }
  if (!title.value.trim()) {
    error.value = 'Titel ist erforderlich.'
    return
  }
  if (!selectedDeviceId.value) {
    error.value = 'Gerät ist erforderlich.'
    return
  }

  saving.value = true
  error.value = null
  try {
    const minMax = getMinMaxTimes(currentPoints.value)
    const fromDate = minMax?.from || new Date(fromInput.value).toISOString()
    const toDate = minMax?.to || new Date(toInput.value).toISOString()

    let travelId = editingTravelId.value
    if (travelId) {
      await $fetch(`/api/manual-travels/${travelId}`, {
        method: 'PATCH',
        body: {
          title: title.value.trim(),
          source_device_id: selectedDeviceId.value,
          from_date: fromDate,
          to_date: toDate,
          notes: notes.value.trim() || null
        }
      })
    } else {
      const createResponse = await $fetch<{ id: string }>('/api/manual-travels', {
        method: 'POST',
        body: {
          title: title.value.trim(),
          source_device_id: selectedDeviceId.value,
          from_date: fromDate,
          to_date: toDate,
          notes: notes.value.trim() || null
        }
      })
      travelId = createResponse.id
      editingTravelId.value = travelId
    }

    await $fetch(`/api/manual-travels/${travelId}/positions`, {
      method: 'POST',
      body: {
        positions: currentPoints.value.map(p => ({
          id: p.id,
          fixTime: p.fixTime,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed,
          altitude: p.altitude,
          attributes: p.attributes || {}
        }))
      }
    })

    await getTravels()
    await loadManualTravels()
    manualtraveldialog.value = false
  } catch (err: any) {
    console.error('Failed to save manual travel:', err)
    error.value = 'Fehler beim Speichern der Reise.'
  } finally {
    saving.value = false
  }
}

async function deleteManualTravel(id: string) {
  if (!id) return
  try {
    await $fetch(`/api/manual-travels/${id}`, { method: 'DELETE' })
    await getTravels()
    await loadManualTravels()
    if (editingTravelId.value === id) {
      editingTravelId.value = null
    }
  } catch (err: any) {
    console.error('Failed to delete manual travel:', err)
    error.value = 'Fehler beim Loeschen der manuellen Reise.'
  }
}

function closeDialog() {
  editingTravelId.value = null
  manualtraveldialog.value = false
}

function isPointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat
    const yi = polygon[i].lng
    const xj = polygon[j].lat
    const yj = polygon[j].lng

    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
      (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi + 0.0000001) + xi)
    if (intersect) inside = !inside
  }
  return inside
}
</script>

<template>
  <v-dialog v-model="manualtraveldialog" fullscreen>
    <v-card>
      <v-toolbar color="grey-darken-3" density="compact">
        <v-toolbar-title>Manuelle Reise-Rekonstruktion</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-menu location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn icon="mdi-format-list-bulleted" size="small" v-bind="props"></v-btn>
          </template>
          <v-list density="compact" lines="one" class="manual-travel-list">
            <v-list-item
              v-for="item in manualTravels"
              :key="item.id"
              class="d-flex align-center"
            >
              <v-list-item-title class="manual-travel-title">
                {{ item.title }}
                <span class="text-caption text-grey ml-2">
                  ({{ formatTravelDate(item.from_date) }} - {{ formatTravelDate(item.to_date) }})
                </span>
              </v-list-item-title>
              <template v-slot:append>
                <v-btn
                  size="x-small"
                  color="primary"
                  variant="text"
                  @click="loadManualTravel(item)"
                >
                  Laden
                </v-btn>
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  color="error"
                  @click="deleteManualTravel(item.id)"
                ></v-btn>
              </template>
            </v-list-item>
            <v-list-item v-if="manualTravels.length === 0">
              <v-list-item-title class="text-caption text-grey">
                Keine manuellen Reisen gespeichert.
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn icon="mdi-close" @click="closeDialog"></v-btn>
      </v-toolbar>

      <v-card-text class="pt-6">
        <v-row class="mb-1 compact-row" align="center">
          <v-col cols="12" md="3" class="compact-col">
            <v-select
              label="Gerät"
              :items="devices"
              item-title="name"
              item-value="id"
              v-model="selectedDeviceId"
              density="compact"
              variant="outlined"
              hide-details
            ></v-select>
          </v-col>
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Von"
              type="datetime-local"
              v-model="fromInput"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Bis"
              type="datetime-local"
              v-model="toInput"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center ga-2 compact-col">
            <v-btn size="small" color="primary" @click="loadPoints" :loading="loading">Daten laden</v-btn>
            <span class="text-caption">Punkte: {{ pointsCount }}</span>
          </v-col>
        </v-row>

        <v-row class="mb-1 compact-row" align="center">
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Titel"
              v-model="title"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6" class="compact-col">
            <v-textarea
              label="Notizen"
              v-model="notes"
              density="compact"
              rows="1"
              auto-grow
              variant="outlined"
              hide-details
            ></v-textarea>
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center ga-2 compact-col">
            <v-btn size="small" color="success" @click="saveTravel" :loading="saving">Speichern</v-btn>
            <span class="text-caption">Auswahl: {{ selectedCount }}</span>
          </v-col>
        </v-row>

        <v-row class="mb-2 compact-row">
          <v-col cols="12" md="12" class="d-flex flex-wrap align-center ga-2 compact-col">
            <v-btn
              size="small"
              :color="lassoMode ? 'warning' : 'grey-darken-1'"
              @click="lassoMode = !lassoMode"
            >
              {{ lassoMode ? 'Lasso aktiv' : 'Lasso' }}
            </v-btn>
            <v-btn size="small" color="primary" @click="applyLassoSelection" :disabled="lassoPath.length < 3">
              Auswahl anwenden
            </v-btn>
            <v-btn size="small" color="grey-darken-1" @click="clearLasso">Lasso leeren</v-btn>
            <v-btn size="small" color="error" @click="deleteSelection" :disabled="selectedCount === 0">
              Auswahl löschen
            </v-btn>
            <v-btn size="small" color="info" @click="keepSelection" :disabled="selectedCount === 0">
              Auswahl behalten
            </v-btn>
            <v-btn size="small" color="grey-darken-2" @click="undo" :disabled="!canUndo">Undo</v-btn>
            <v-btn size="small" color="grey-darken-2" @click="redo" :disabled="!canRedo">Redo</v-btn>
            <v-btn size="small" color="grey-darken-3" @click="resetWorkspace">Zurücksetzen</v-btn>
          </v-col>
        </v-row>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-3"
        >
          {{ error }}
        </v-alert>

        <div style="height: 70vh; width: 100%;">
          <GoogleMap
            :api-key="mapsApiKey"
            :map-id="mapsMapId"
            :center="mapCenter"
            :zoom="6"
            style="height: 100%; width: 100%;"
            @click="onMapClick"
          >
            <Polyline
              v-if="polylinePath.length > 0"
              :options="{
                path: polylinePath,
                strokeColor: '#1976d2',
                strokeOpacity: 0.9,
                strokeWeight: 3
              }"
            />

            <Polygon
              v-if="lassoPath.length >= 3"
              :options="{
                paths: lassoPath,
                strokeColor: '#ff9800',
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillColor: '#ffcc80',
                fillOpacity: 0.2
              }"
            />

            <Marker
              v-for="marker in selectedMarkers"
              :key="marker.id"
              :options="{
                position: { lat: marker.latitude, lng: marker.longitude },
                icon: {
                  path: 0,
                  fillColor: '#ff5252',
                  fillOpacity: 1,
                  strokeWeight: 1,
                  strokeColor: '#ffffff',
                  scale: 6
                }
              }"
            />
          </GoogleMap>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.manual-travel-list {
  max-height: 140px;
  overflow-y: auto;
}

.manual-travel-list :deep(.v-list-item__append) {
  margin-inline-start: 8px;
}

.manual-travel-title {
  flex: 1 1 auto;
  min-width: 0;
}

.manual-travel-title span {
  white-space: nowrap;
}

.compact-row {
  margin-left: 0;
  margin-right: 0;
}

.compact-col {
  padding-top: 2px;
  padding-bottom: 2px;
}
</style>
