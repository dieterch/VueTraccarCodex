<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import 'leaflet/dist/leaflet.css'
import { GoogleMapsLink, stripPlusCode } from '~/utils/maps'
import { useMapData } from '~/composables/useMapData'
import { useDocuments } from '~/composables/useDocuments'
import { useAuth } from '~/composables/useAuth'
import MDDialog from '../MDDialog.vue'

const config = useRuntimeConfig()
const {
  polylines,
  sideTripPolylines,
  center,
  zoom,
  locations,
  togglemarkers,
  togglepath,
  isLoading,
  loadingMessage,
  fetchSideTrips,
  clearSideTrips,
  poiMode,
  renderMap
} = useMapData()
const { getDocument } = useDocuments()
const { isAdmin } = useAuth()

const mapContainer = ref<HTMLElement | null>(null)
const leafletReady = ref(false)
const mddialog = ref(false)
const mode = ref('light')
const content = ref('')
const file = ref('')

let L: any = null
let map: any = null
let polylineLayerGroup: any = null
let markerLayerGroup: any = null
let activeTimestampPopup: any = null

const isCtrlPressed = ref(false)

const renderedPolylines = computed(() => {
  return [
    ...polylines.value.map((line) => ({ ...line, opacity: 1 })),
    ...sideTripPolylines.value.map((line) => ({ ...line, opacity: 0.8 }))
  ]
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Meta' || e.metaKey || e.ctrlKey) {
    isCtrlPressed.value = true
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Meta' || (!e.metaKey && !e.ctrlKey)) {
    isCtrlPressed.value = false
  }
}

async function openmddialog(key: string) {
  content.value = await getDocument(key)
  file.value = key
  mddialog.value = true
}

async function copyToClipboard(key: string) {
  try {
    await navigator.clipboard.writeText(key)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = key
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

function findNearestPosition(lat: number, lng: number, path: any[]) {
  let minDist = Infinity
  let nearest = null
  for (const pos of path || []) {
    const dist = Math.sqrt(Math.pow(pos.lat - lat, 2) + Math.pow(pos.lng - lng, 2))
    if (dist < minDist) {
      minDist = dist
      nearest = pos
    }
  }
  return nearest
}

function findNearestPolylinePoint(lat: number, lng: number) {
  let minDist = Infinity
  let nearest: any = null
  for (const polyline of polylines.value) {
    for (const pos of polyline.path || []) {
      const dist = Math.sqrt(Math.pow(pos.lat - lat, 2) + Math.pow(pos.lng - lng, 2))
      if (dist < minDist) {
        minDist = dist
        nearest = { ...pos, deviceId: polyline.deviceId }
      }
    }
  }
  return nearest
}

async function reverseGeocodePOI(lat: number, lng: number) {
  const apiKey = config.public.googleMapsApiKey
  if (!apiKey) {
    return { country: 'Unknown', address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    const response = await $fetch<any>(url)
    if (response.status === 'OK' && response.results.length > 0) {
      const result = response.results[0]
      const countryComponent = result.address_components.find((comp: any) => comp.types.includes('country'))
      return {
        country: countryComponent?.long_name || 'Unknown',
        address: result.formatted_address
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error)
  }

  return { country: 'Unknown', address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }
}

async function createManualPOI(lat: number, lng: number, timestamp: string, deviceId: number) {
  try {
    isLoading.value = true
    loadingMessage.value = 'Creating POI...'

    const currentCenter = map?.getCenter?.()
    const currentZoom = map?.getZoom?.()

    const key = (`marker${String(lat).substring(0, 7)}${String(lng).substring(0, 7)}`)
      .replace(/\./g, '')
      .replace(/-/g, 'M')

    const { country, address } = await reverseGeocodePOI(lat, lng)
    await $fetch('/api/manual-pois', {
      method: 'POST',
      body: { lat, lng, timestamp, deviceId, address, country, key }
    })

    await renderMap()
    await nextTick()
    if (map && currentCenter && Number.isFinite(currentZoom)) {
      map.setView(currentCenter, currentZoom, { animate: false })
    }
  } catch (error) {
    console.error('Error creating POI:', error)
    alert('Fehler beim Erstellen des POI')
  } finally {
    isLoading.value = false
  }
}

async function createIndependentPOI(lat: number, lng: number) {
  const nearest = findNearestPolylinePoint(lat, lng)
  if (!nearest?.timestamp) {
    alert('Could not find nearby route. Please click closer to a route.')
    return
  }
  await createManualPOI(lat, lng, nearest.timestamp, nearest.deviceId)
}

async function deleteManualPOI(location: any) {
  const addressShort = String(location?.address || '').split(',')[0] || 'POI'
  if (!confirm(`POI "${addressShort}" und zugehörige Anpassungen löschen?`)) return
  try {
    isLoading.value = true
    loadingMessage.value = 'Lösche POI...'
    try {
      await $fetch(`/api/standstill-adjustments/${location.key}`, { method: 'DELETE' })
    } catch {
      // ignore if no adjustments exist
    }
    await $fetch(`/api/manual-pois/${location.poiId}`, { method: 'DELETE' })
    clearSideTrips()
    await renderMap()
  } catch (error) {
    console.error('Error deleting POI:', error)
    alert('Fehler beim Löschen des POI')
  } finally {
    isLoading.value = false
  }
}

async function loadStandstillSideTrips(location: any) {
  try {
    const settingsResponse = await $fetch<any>('/api/side-trips/config')
    if (!settingsResponse.success || !settingsResponse.settings.sideTripEnabled) {
      alert(
        isAdmin.value
          ? 'Side trip tracking is not enabled. Please enable it in settings first.'
          : 'Side trip tracking is disabled. Ask an admin to enable it in Settings.'
      )
      return
    }

    const deviceIds = settingsResponse.settings.sideTripDevices
      ?.filter((d: any) => d.enabled)
      .map((d: any) => d.deviceId) || []
    if (deviceIds.length === 0) {
      alert(
        isAdmin.value
          ? 'No secondary devices configured. Please add devices in settings.'
          : 'Side trip devices are not configured.'
      )
      return
    }

    const fromDate = new Date(location.von)
    const toDate = new Date(location.bis)
    if (location.isPOI || location.period === 0) {
      fromDate.setMinutes(fromDate.getMinutes() - 15)
      toDate.setMinutes(toDate.getMinutes() + 15)
    }
    const fromAdjusted = fromDate.toISOString().slice(0, 16).replace('T', ' ')
    const toAdjusted = toDate.toISOString().slice(0, 16).replace('T', ' ')
    await fetchSideTrips(fromAdjusted, toAdjusted, deviceIds)
  } catch (error) {
    console.error('Error loading side trips:', error)
    alert('Failed to load side trips.')
  }
}

const popupHtml = (location: any) => {
  const title = stripPlusCode(String(location?.address || '').split(',')[0] || location?.title || 'Location')
  const details = location?.isPOI
    ? `<div>am: ${new Date(location.von).toLocaleString()}</div>`
    : `<div>von: ${location.von}</div><div>bis: ${location.bis}</div><div>Dauer: ${location.period}h</div>`
  const deleteButton = isAdmin.value && location.isPOI
    ? `<button class="osm-btn osm-delete" data-action="delete">POI löschen</button>`
    : ''
  return `
    <div class="osm-popup" data-location-key="${location.key}">
      <h4>${title}</h4>
      <div class="osm-addr">${location.address || ''}</div>
      ${details}
      <div><a href="${GoogleMapsLink(location.lat, location.lng)}" target="_blank">Link zu Google Maps</a></div>
      <div class="osm-actions">
        <button class="osm-btn" data-action="notes">Notizen</button>
        <button class="osm-btn" data-action="sidetrips">Ausflüge</button>
        <button class="osm-btn" data-action="copy">Marker kopieren</button>
        ${deleteButton}
      </div>
    </div>
  `
}

const bindPopupActions = (marker: any, location: any) => {
  marker.on('popupopen', (event: any) => {
    const root = event?.popup?.getElement?.() as HTMLElement | null
    if (!root) return
    root.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', async (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        const action = (button as HTMLElement).dataset.action
        if (action === 'notes') await openmddialog(location.key)
        if (action === 'sidetrips') await loadStandstillSideTrips(location)
        if (action === 'copy') await copyToClipboard(location.key)
        if (action === 'delete') await deleteManualPOI(location)
      })
    })
  })
}

const drawPolylines = () => {
  if (!leafletReady.value || !polylineLayerGroup) return
  polylineLayerGroup.clearLayers()
  if (!togglepath.value) return

  for (const line of renderedPolylines.value) {
    if (!Array.isArray(line.path) || line.path.length === 0) continue
    const latLngs = line.path.map((point: any) => [point.lat, point.lng])
    const leafletLine = L.polyline(latLngs, {
      color: line.color || '#1976d2',
      weight: line.lineWeight || 3,
      opacity: line.opacity
    }).addTo(polylineLayerGroup)

    leafletLine.on('click', async (event: any) => {
      const clickedLat = event.latlng.lat
      const clickedLng = event.latlng.lng
      const nearest = findNearestPosition(clickedLat, clickedLng, line.path)
      if (!nearest?.timestamp) return

      if (poiMode.value) {
        await createManualPOI(clickedLat, clickedLng, nearest.timestamp, line.deviceId)
        return
      }

      if (activeTimestampPopup) {
        map.removeLayer(activeTimestampPopup)
      }
      activeTimestampPopup = L.popup()
        .setLatLng([clickedLat, clickedLng])
        .setContent(`<div>${new Date(nearest.timestamp).toLocaleString()}</div>`)
        .openOn(map)
    })
  }
}

const drawMarkers = () => {
  if (!leafletReady.value || !markerLayerGroup) return
  markerLayerGroup.clearLayers()
  if (!togglemarkers.value) return

  for (const location of locations.value) {
    const marker = L.circleMarker([location.lat, location.lng], {
      radius: location.isPOI ? 7 : 6,
      color: location.isPOI ? '#43A047' : '#E53935',
      weight: 2,
      fillOpacity: 0.9
    })
    marker.bindPopup(popupHtml(location), { maxWidth: 420 })
    bindPopupActions(marker, location)
    markerLayerGroup.addLayer(marker)
  }
}

const syncViewport = () => {
  if (!map) return
  const currentCenter = map.getCenter?.()
  const shouldMove =
    !currentCenter ||
    Math.abs(currentCenter.lat - center.value.lat) > 0.0001 ||
    Math.abs(currentCenter.lng - center.value.lng) > 0.0001 ||
    map.getZoom?.() !== zoom.value
  if (shouldMove) {
    map.setView([center.value.lat, center.value.lng], zoom.value, { animate: false })
  }
}

onMounted(async () => {
  if (!process.client || !mapContainer.value) return
  const leafletModule = await import('leaflet')
  L = leafletModule.default || leafletModule

  map = L.map(mapContainer.value, {
    zoomControl: true,
    preferCanvas: true
  }).setView([center.value.lat, center.value.lng], zoom.value)

  map.on('click', async (event: any) => {
    const domEvent = event?.originalEvent
    const isModifierPressed = domEvent?.metaKey || domEvent?.ctrlKey || isCtrlPressed.value
    if (poiMode.value && isModifierPressed) {
      await createIndependentPOI(event.latlng.lat, event.latlng.lng)
    }
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map)

  polylineLayerGroup = L.layerGroup().addTo(map)
  markerLayerGroup = L.layerGroup().addTo(map)
  leafletReady.value = true

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  drawPolylines()
  drawMarkers()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  if (map) {
    map.remove()
    map = null
  }
})

watch([renderedPolylines, togglepath], () => drawPolylines(), { deep: true })
watch([locations, togglemarkers], () => drawMarkers(), { deep: true })
watch([center, zoom], () => syncViewport(), { deep: true })
</script>

<template>
  <div class="leaflet-wrapper">
    <div v-if="isLoading" class="leaflet-loading">
      <v-progress-circular indeterminate color="primary" size="64" width="6"></v-progress-circular>
      <div class="leaflet-loading-text">{{ loadingMessage }}</div>
    </div>
    <div ref="mapContainer" class="leaflet-map"></div>

    <MDDialog
      :content="content"
      :file="file"
      :mode="mode"
      :key="mddialog"
      :dialog="mddialog"
      @dialog="(e: boolean) => { mddialog = e }"
    />
  </div>
</template>

<style scoped>
.leaflet-wrapper {
  width: 100%;
  height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
  position: relative;
}

.leaflet-map {
  width: 100%;
  height: 100%;
}

.leaflet-loading {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.leaflet-loading-text {
  margin-top: 12px;
  color: #1976d2;
  font-weight: 500;
}
</style>

<style>
.osm-popup {
  min-width: 260px;
}

.osm-popup h4 {
  margin: 0 0 6px 0;
}

.osm-addr {
  font-size: 12px;
  color: #555;
  margin-bottom: 8px;
}

.osm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 10px;
}

.osm-btn {
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  background: #fff;
  padding: 6px;
  font-size: 12px;
  cursor: pointer;
}

.osm-btn:hover {
  background: #eceff1;
}

.osm-delete {
  border-color: #ef9a9a;
  color: #b71c1c;
}
</style>

