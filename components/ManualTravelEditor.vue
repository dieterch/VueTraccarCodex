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
const { getDevices, device, travels, travel } = useTraccar()

const devices = ref<TraccarDevice[]>([])
const selectedDeviceId = ref<number | null>(null)
const manualTravels = ref<any[]>([])
const editingTravelId = ref<string | null>(null)
const editorMode = ref<'manual' | 'repair'>('manual')
const selectedRepairTravelKey = ref<string | null>(null)

const fromInput = ref<string>('2019-05-05T00:00')
const toInput = ref<string>(new Date().toISOString().slice(0, 16))

const rawPoints = ref<ManualPoint[]>([])
const currentPoints = ref<ManualPoint[]>([])
const selectedPointIds = ref<string[]>([])
const replacementDeviceId = ref<number | null>(null)
const replacementFromInput = ref<string>('2019-05-05T00:00')
const replacementToInput = ref<string>(new Date().toISOString().slice(0, 16))
const replacementPoints = ref<ManualPoint[]>([])
const selectedReplacementPointIds = ref<string[]>([])
const selectionLayer = ref<'target' | 'replacement'>('target')
const manualPointMode = ref(false)
const manualPointTimeInput = ref<string>(new Date().toISOString().slice(0, 16))
const selectedManualPointTimeInput = ref<string>(new Date().toISOString().slice(0, 16))

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
const selectedReplacementCount = computed(() => selectedReplacementPointIds.value.length)
const pointsCount = computed(() => currentPoints.value.length)
const replacementPointsCount = computed(() => replacementPoints.value.length)
const selectedManualPointCount = computed(() => {
  const selectedSet = new Set(selectedPointIds.value)
  return currentPoints.value.filter(p => selectedSet.has(p.id) && p.attributes?.source === 'manual-repair').length
})

const mapRef = ref<any>(null)
const mapCenter = ref<{ lat: number; lng: number }>({ lat: 0, lng: 0 })
const mapZoom = ref<number>(6)

function setMapToPoints(points: ManualPoint[]) {
  if (points.length === 0) {
    mapCenter.value = { lat: 0, lng: 0 }
    return
  }
  const mid = points[Math.floor(points.length / 2)]
  mapCenter.value = { lat: mid.latitude, lng: mid.longitude }
}

const polylinePath = computed(() => currentPoints.value.map(p => ({ lat: p.latitude, lng: p.longitude })))
const rawPolylinePath = computed(() => rawPoints.value.map(p => ({ lat: p.latitude, lng: p.longitude })))
const replacementPolylinePath = computed(() => replacementPoints.value.map(p => ({ lat: p.latitude, lng: p.longitude })))

const selectedMarkers = computed(() => {
  const selectedSet = new Set(selectedPointIds.value)
  const markers = currentPoints.value.filter(p => selectedSet.has(p.id))
  return markers.slice(0, 500)
})
const selectedReplacementMarkers = computed(() => {
  const selectedSet = new Set(selectedReplacementPointIds.value)
  const markers = replacementPoints.value.filter(p => selectedSet.has(p.id))
  return markers.slice(0, 500)
})
const manualMarkers = computed(() => {
  return currentPoints.value
    .filter(p => p.attributes?.source === 'manual-repair')
    .slice(0, 500)
})
const repairTravelOptions = computed(() => {
  return travels.value
    .filter(item => item?.source !== 'manual')
    .map(item => ({
      title: `${item.title || 'Reise'} (${formatTravelDate(item.von)} - ${formatTravelDate(item.bis)})`,
      value: getTravelOptionKey(item),
      raw: item
    }))
})

function getTravelOptionKey(item: any) {
  return `${item?.source || 'auto'}:${item?.id || `${item?.deviceId || ''}:${item?.von}:${item?.bis}`}`
}

function normalizeRoutePoint(pos: any, source: string): ManualPoint {
  return {
    id: String(pos.id || `${source}-${pos.fixTime}-${pos.latitude}-${pos.longitude}`),
    fixTime: pos.fixTime || pos.fix_time,
    latitude: Number(pos.latitude),
    longitude: Number(pos.longitude),
    speed: pos.speed,
    altitude: pos.altitude,
    attributes: {
      ...(pos.attributes || {}),
      source
    }
  }
}

function sortPointsByTime(points: ManualPoint[]) {
  return [...points].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime())
}

function setRepairMode(value: string | null) {
  editorMode.value = value === 'repair' ? 'repair' : 'manual'
  clearRepairState()
}

function clearRepairState() {
  selectedRepairTravelKey.value = null
  replacementPoints.value = []
  selectedReplacementPointIds.value = []
  selectionLayer.value = 'target'
  manualPointMode.value = false
}

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

function upsertManualTravelInList(item: any) {
  if (!item?.id) return
  const next = [...travels.value]
  const index = next.findIndex(t => t.id === item.id && t.source === 'manual')
  const entry = {
    id: item.id,
    title: item.title,
    von: item.from_date || item.fromDate,
    bis: item.to_date || item.toDate,
    distance: 0,
    source: 'manual',
    deviceId: item.source_device_id || item.sourceDeviceId,
    notes: item.notes || null,
    created_at: item.created_at
  }
  if (index >= 0) {
    next[index] = { ...next[index], ...entry }
  } else {
    next.push(entry as any)
  }
  travels.value = next
}

function removeManualTravelFromList(id: string) {
  travels.value = travels.value.filter(t => !(t.id === id && t.source === 'manual'))
  if (travel.value?.id === id && travel.value?.source === 'manual') {
    travel.value = travels.value.length ? travels.value[travels.value.length - 1] : null
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

    const points: ManualPoint[] = route.map(pos => normalizeRoutePoint(pos, editorMode.value === 'repair' ? 'repair-original' : 'manual-source'))

    rawPoints.value = points
    currentPoints.value = clonePoints(points)
    selectedPointIds.value = []
    lassoPath.value = []
    resetHistory(points)
    setMapToPoints(points)
    mapZoom.value = 6
    manualPointTimeInput.value = fromInput.value
  } catch (err: any) {
    console.error('Failed to load points:', err)
    error.value = 'Fehler beim Laden der Positionsdaten.'
  } finally {
    loading.value = false
  }
}

async function loadRepairTravel() {
  const option = repairTravelOptions.value.find(item => item.value === selectedRepairTravelKey.value)
  const item = option?.raw
  if (!item) {
    error.value = 'Bitte Zielreise auswählen.'
    return
  }

  selectedDeviceId.value = Number(item.deviceId || device.value?.id || selectedDeviceId.value)
  fromInput.value = item.von ? item.von.slice(0, 16) : fromInput.value
  toInput.value = item.bis ? item.bis.slice(0, 16) : toInput.value
  replacementFromInput.value = fromInput.value
  replacementToInput.value = toInput.value
  manualPointTimeInput.value = fromInput.value
  title.value = `Reparatur - ${item.title || 'Reise'}`
  notes.value = [
    `Repair for ${item.source || 'auto'} travel ${item.id || selectedRepairTravelKey.value}`,
    `Original title: ${item.title || ''}`
  ].filter(Boolean).join('\n')

  await loadPoints()
}

async function loadReplacementPoints() {
  error.value = null
  const fromDate = parseInputDate(replacementFromInput.value)
  const toDate = parseInputDate(replacementToInput.value)

  if (!replacementDeviceId.value || !fromDate || !toDate) {
    error.value = 'Bitte Ersatzgerät und Zeitraum auswählen.'
    return
  }

  loading.value = true
  try {
    const route = await $fetch<any[]>('/api/manual-route', {
      method: 'POST',
      body: {
        deviceId: replacementDeviceId.value,
        from: fromDate.toISOString(),
        to: toDate.toISOString()
      }
    })

    replacementPoints.value = route.map(pos => normalizeRoutePoint(pos, 'repair-replacement'))
    selectedReplacementPointIds.value = []
    selectionLayer.value = 'replacement'
    if (replacementPoints.value.length > 0) {
      setMapToPoints(replacementPoints.value)
    }
  } catch (err: any) {
    console.error('Failed to load replacement points:', err)
    error.value = 'Fehler beim Laden der Ersatzdaten.'
  } finally {
    loading.value = false
  }
}

async function loadManualTravel(item: any) {
  if (!item?.id) return
  error.value = null
  editorMode.value = 'manual'
  clearRepairState()
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
    setMapToPoints(points)
    mapZoom.value = 6
  } catch (err: any) {
    console.error('Failed to load manual travel:', err)
    error.value = 'Fehler beim Laden der manuellen Reise.'
  } finally {
    loading.value = false
  }
}

function onMapClick(event: any) {
  if (!event?.latLng) return
  if (manualPointMode.value) {
    addManualPoint(event.latLng.lat(), event.latLng.lng())
    return
  }
  if (!lassoMode.value) return
  lassoPath.value = [
    ...lassoPath.value,
    { lat: event.latLng.lat(), lng: event.latLng.lng() }
  ]
}

function clearLasso() {
  lassoPath.value = []
  selectedPointIds.value = []
  selectedReplacementPointIds.value = []
}

function applyLassoSelection() {
  if (lassoPath.value.length < 3) return
  const points = selectionLayer.value === 'replacement' ? replacementPoints.value : currentPoints.value
  const selected = points
    .filter(p => isPointInPolygon({ lat: p.latitude, lng: p.longitude }, lassoPath.value))
    .map(p => p.id)
  if (selectionLayer.value === 'replacement') {
    selectedReplacementPointIds.value = selected
  } else {
    selectedPointIds.value = selected
  }
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
  selectedReplacementPointIds.value = []
  lassoPath.value = []
  resetHistory(currentPoints.value)
  setMapToPoints(currentPoints.value)
  mapZoom.value = 6
}

function importReplacementSelection() {
  const selectedSet = new Set(selectedReplacementPointIds.value)
  const points = selectedSet.size > 0
    ? replacementPoints.value.filter(p => selectedSet.has(p.id))
    : replacementPoints.value

  if (points.length === 0) {
    error.value = 'Keine Ersatzpunkte zum Übernehmen ausgewählt.'
    return
  }

  const importId = Date.now()
  currentPoints.value = sortPointsByTime([
    ...currentPoints.value,
    ...points.map((p, index) => ({
      ...p,
      id: `replacement-${importId}-${index}-${p.id}`,
      attributes: {
        ...(p.attributes || {}),
        source: 'repair-replacement',
        sourceDeviceId: replacementDeviceId.value
      }
    }))
  ])
  selectedReplacementPointIds.value = []
  selectedPointIds.value = []
  lassoPath.value = []
  pushHistory(currentPoints.value)
}

function addManualPoint(lat: number, lng: number) {
  const parsed = parseInputDate(manualPointTimeInput.value)
  const fixTime = parsed?.toISOString() || new Date().toISOString()
  const point: ManualPoint = {
    id: `manual-repair-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    fixTime,
    latitude: lat,
    longitude: lng,
    speed: 0,
    altitude: 0,
    attributes: {
      source: 'manual-repair'
    }
  }

  currentPoints.value = sortPointsByTime([...currentPoints.value, point])
  selectedPointIds.value = [point.id]
  selectedManualPointTimeInput.value = manualPointTimeInput.value
  pushHistory(currentPoints.value)
}

function shiftSelectedManualPointTimes() {
  const parsed = parseInputDate(selectedManualPointTimeInput.value)
  if (!parsed) {
    error.value = 'Bitte gültige Zielzeit fuer manuelle Punkte auswählen.'
    return
  }

  const selectedSet = new Set(selectedPointIds.value)
  const selectedManualIds = new Set(
    currentPoints.value
      .filter(p => selectedSet.has(p.id) && p.attributes?.source === 'manual-repair')
      .map(p => p.id)
  )

  if (selectedManualIds.size === 0) {
    error.value = 'Keine manuellen Reparaturpunkte ausgewählt.'
    return
  }

  const fixTime = parsed.toISOString()
  currentPoints.value = sortPointsByTime(
    currentPoints.value.map(p => selectedManualIds.has(p.id)
      ? {
          ...p,
          fixTime,
          attributes: {
            ...(p.attributes || {}),
            source: 'manual-repair',
            timeAdjusted: true
          }
        }
      : p
    )
  )
  selectedPointIds.value = [...selectedManualIds]
  error.value = null
  pushHistory(currentPoints.value)
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
    currentPoints.value = sortPointsByTime(currentPoints.value)
    const minMax = getMinMaxTimes(currentPoints.value)
    const fromDate = minMax?.from || new Date(fromInput.value).toISOString()
    const toDate = minMax?.to || new Date(toInput.value).toISOString()
    const savedNotes = editorMode.value === 'repair'
      ? [
          notes.value.trim(),
          `Repair mode: replacementDeviceId=${replacementDeviceId.value || 'none'}`
        ].filter(Boolean).join('\n')
      : notes.value.trim()

    let travelId = editingTravelId.value
    if (travelId) {
      await $fetch(`/api/manual-travels/${travelId}`, {
        method: 'PATCH',
        body: {
          title: title.value.trim(),
          source_device_id: selectedDeviceId.value,
          from_date: fromDate,
          to_date: toDate,
          notes: savedNotes || null
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
          notes: savedNotes || null
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

    await loadManualTravels()
    const updated = {
      id: travelId,
      title: title.value.trim(),
      source_device_id: selectedDeviceId.value,
      from_date: fromDate,
      to_date: toDate,
      notes: savedNotes || null
    }
    upsertManualTravelInList(updated)
    clearRepairState()
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
    await loadManualTravels()
    if (editingTravelId.value === id) {
      editingTravelId.value = null
    }
    removeManualTravelFromList(id)
  } catch (err: any) {
    console.error('Failed to delete manual travel:', err)
    error.value = 'Fehler beim Loeschen der manuellen Reise.'
  }
}

function closeDialog() {
  editingTravelId.value = null
  clearRepairState()
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

function syncMapView() {
  const map = mapRef.value?.map
  if (!map) return
  const center = map.getCenter?.()
  if (center) {
    mapCenter.value = { lat: center.lat(), lng: center.lng() }
  }
  const zoom = map.getZoom?.()
  if (typeof zoom === 'number') {
    mapZoom.value = zoom
  }
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Meter
  const toRad = (v: number) => v * Math.PI / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function secondsBetween(a: string, b: string) {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / 1000
  )
}

type TraccarFilterConfig = {
  skipLimit: number        // seconds
  zero: boolean
  duplicate: boolean
  distance: number         // meters
}

const DEFAULT_FILTER: TraccarFilterConfig = {
  skipLimit: 14400,
  zero: true,
  duplicate: true,
  distance: 50
}

function reducePointsTraccar(
  points: ManualPoint[],
  cfg: TraccarFilterConfig
): ManualPoint[] {
  if (points.length === 0) return []

  const sorted = [...points].sort(
    (a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime()
  )

  const result: ManualPoint[] = []
  let lastKept: ManualPoint | null = null

  for (const p of sorted) {

    // filter.zero
    if (cfg.zero && p.latitude === 0 && p.longitude === 0) {
      continue
    }

    if (lastKept) {

      // filter.skipLimit
      const gap = secondsBetween(lastKept.fixTime, p.fixTime)
      if (gap > cfg.skipLimit) {
        result.push(p)
        lastKept = p
        continue
      }

      // filter.duplicate (same fixTime)
      if (cfg.duplicate && p.fixTime === lastKept.fixTime) {
        continue
      }

      // filter.distance
      const dist = haversineDistance(
        lastKept.latitude,
        lastKept.longitude,
        p.latitude,
        p.longitude
      )

      if (dist < cfg.distance) {
        continue
      }
    }

    result.push(p)
    lastKept = p
  }

  return result
}

function runDataReduction() {
  if (currentPoints.value.length === 0) return

  const reduced = reducePointsTraccar(
    currentPoints.value,
    DEFAULT_FILTER
  )

  currentPoints.value = clonePoints(reduced)
  selectedPointIds.value = []
  lassoPath.value = []

  pushHistory(currentPoints.value)
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
        <v-row class="mb-2 compact-row" align="center">
          <v-col cols="12" md="3" class="compact-col">
            <v-btn-toggle
              :model-value="editorMode"
              density="compact"
              mandatory
              divided
              @update:model-value="setRepairMode"
            >
              <v-btn value="manual" size="small">Manuell</v-btn>
              <v-btn value="repair" size="small">Reparatur</v-btn>
            </v-btn-toggle>
          </v-col>
          <v-col v-if="editorMode === 'repair'" cols="12" md="6" class="compact-col">
            <v-select
              label="Kaputte Reise"
              :items="repairTravelOptions"
              item-title="title"
              item-value="value"
              v-model="selectedRepairTravelKey"
              density="compact"
              variant="outlined"
              hide-details
            ></v-select>
          </v-col>
          <v-col v-if="editorMode === 'repair'" cols="12" md="3" class="d-flex align-center ga-2 compact-col">
            <v-btn size="small" color="primary" @click="loadRepairTravel" :disabled="!selectedRepairTravelKey" :loading="loading">
              Vorlage laden
            </v-btn>
          </v-col>
        </v-row>

        <v-row class="mb-1 compact-row" align="center">
          <v-col cols="12" md="3" class="compact-col">
            <v-select
              :label="editorMode === 'repair' ? 'Originalgerät' : 'Gerät'"
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
            <v-btn size="small" color="primary" @click="loadPoints" :loading="loading">
              {{ editorMode === 'repair' ? 'Originalspur laden' : 'Daten laden' }}
            </v-btn>
            <span class="text-caption">Punkte: {{ pointsCount }}</span>
          </v-col>
        </v-row>

        <v-row v-if="editorMode === 'repair'" class="mb-1 compact-row" align="center">
          <v-col cols="12" md="3" class="compact-col">
            <v-select
              label="Ersatzgerät"
              :items="devices"
              item-title="name"
              item-value="id"
              v-model="replacementDeviceId"
              density="compact"
              variant="outlined"
              hide-details
            ></v-select>
          </v-col>
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Ersatz von"
              type="datetime-local"
              v-model="replacementFromInput"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Ersatz bis"
              type="datetime-local"
              v-model="replacementToInput"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center ga-2 compact-col">
            <v-btn size="small" color="info" @click="loadReplacementPoints" :loading="loading">
              Ersatzspur laden
            </v-btn>
            <span class="text-caption">Ersatz: {{ replacementPointsCount }}</span>
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
            <span class="text-caption">
              Auswahl: {{ selectionLayer === 'replacement' ? selectedReplacementCount : selectedCount }}
            </span>
          </v-col>
        </v-row>

        <v-row v-if="editorMode === 'repair'" class="mb-1 compact-row" align="center">
          <v-col cols="12" md="3" class="compact-col">
            <v-btn-toggle
              v-model="selectionLayer"
              density="compact"
              mandatory
              divided
            >
              <v-btn value="target" size="small">Zielspur</v-btn>
              <v-btn value="replacement" size="small">Ersatzspur</v-btn>
            </v-btn-toggle>
          </v-col>
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Zeit fuer manuelle Punkte"
              type="datetime-local"
              v-model="manualPointTimeInput"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3" class="compact-col">
            <v-text-field
              label="Neue Zeit fuer Auswahl"
              type="datetime-local"
              v-model="selectedManualPointTimeInput"
              density="compact"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3" class="d-flex flex-wrap align-center ga-2 compact-col">
            <v-btn
              size="small"
              color="info"
              @click="importReplacementSelection"
              :disabled="replacementPointsCount === 0"
            >
              {{ selectedReplacementCount > 0 ? 'Auswahl übernehmen' : 'Ersatzspur übernehmen' }}
            </v-btn>
            <v-btn
              size="small"
              :color="manualPointMode ? 'orange-darken-2' : 'grey-darken-1'"
              @click="manualPointMode = !manualPointMode"
            >
              {{ manualPointMode ? 'Punkt setzen aktiv' : 'Punkt setzen' }}
            </v-btn>
            <v-btn
              size="small"
              color="orange-darken-2"
              @click="shiftSelectedManualPointTimes"
              :disabled="selectedManualPointCount === 0"
            >
              Zeit setzen
            </v-btn>
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center compact-col">
            <span class="text-caption">
              Manuell gewählt: {{ selectedManualPointCount }} · Grau: Original · Blau: Ersatz · Grün: Reparatur · Orange: manuell
            </span>
          </v-col>
        </v-row>

        <v-row class="mb-2 compact-row">
          <v-col cols="13" md="13" class="d-flex flex-wrap align-center ga-2 compact-col">
            <v-btn
              size="small"
              :color="lassoMode ? 'warning' : 'grey-darken-1'"
              @click="lassoMode = !lassoMode; manualPointMode = false"
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
            <v-btn
              size="small"
              color="deep-purple"
              @click="runDataReduction"
              :disabled="pointsCount === 0"
            >
              Daten reduzieren
            </v-btn>

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
            ref="mapRef"
            :api-key="mapsApiKey"
            :map-id="mapsMapId"
            :center="mapCenter"
            :zoom="mapZoom"
            style="height: 100%; width: 100%;"
            @click="onMapClick"
            @idle="syncMapView"
          >
            <Polyline
              v-if="editorMode === 'repair' && rawPolylinePath.length > 0"
              :options="{
                path: rawPolylinePath,
                strokeColor: '#757575',
                strokeOpacity: 0.45,
                strokeWeight: 5
              }"
            />

            <Polyline
              v-if="editorMode === 'repair' && replacementPolylinePath.length > 0"
              :options="{
                path: replacementPolylinePath,
                strokeColor: '#2196f3',
                strokeOpacity: 0.75,
                strokeWeight: 3
              }"
            />

            <Polyline
              v-if="polylinePath.length > 0"
              :options="{
                path: polylinePath,
                strokeColor: editorMode === 'repair' ? '#2e7d32' : '#1976d2',
                strokeOpacity: 0.9,
                strokeWeight: editorMode === 'repair' ? 4 : 3
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
              v-for="marker in selectedReplacementMarkers"
              :key="`replacement-${marker.id}`"
              :options="{
                position: { lat: marker.latitude, lng: marker.longitude },
                icon: {
                  path: 0,
                  fillColor: '#2196f3',
                  fillOpacity: 1,
                  strokeWeight: 1,
                  strokeColor: '#ffffff',
                  scale: 6
                }
              }"
            />

            <Marker
              v-for="marker in manualMarkers"
              :key="`manual-${marker.id}`"
              :options="{
                position: { lat: marker.latitude, lng: marker.longitude },
                icon: {
                  path: 0,
                  fillColor: '#fb8c00',
                  fillOpacity: 1,
                  strokeWeight: 1,
                  strokeColor: '#ffffff',
                  scale: 5
                }
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
