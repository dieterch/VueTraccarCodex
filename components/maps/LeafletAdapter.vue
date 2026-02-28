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

const loadingSideTrips = ref<Record<string, boolean>>({})
const loadedSideTrips = ref<Record<string, boolean>>({})
const standstillAdjustments = ref<Record<string, { start: number; end: number }>>({})
const wordpressPosts = ref<Record<string, any[]>>({})
const currentAdjustmentLocation = ref<any>(null)
const adjustmentDialog = ref(false)
const polylineVisibility = ref<Record<string, boolean>>({})

let L: any = null
let map: any = null
let polylineLayerGroup: any = null
let markerLayerGroup: any = null
let activeTimestampPopup: any = null

const markerByKey = new Map<string, any>()
const isCtrlPressed = ref(false)

const renderedPolylines = computed(() => {
  return [
    ...visibleMainPolylines.value.map((line) => ({ ...line, opacity: 1 })),
    ...visibleSideTripPolylines.value.map((line) => ({ ...line, opacity: 0.8 }))
  ]
})

const getMainPolylineKey = (polyline: any, index: number) => (
  polyline.routeKey ? `main-${polyline.routeKey}` : `main-${polyline.deviceId}-${index}`
)

function isPolylineVisible(key: string) {
  const visible = polylineVisibility.value[key]
  return visible === undefined ? true : visible
}

function togglePolylineVisibility(key: string) {
  const current = polylineVisibility.value[key] ?? true
  polylineVisibility.value = {
    ...polylineVisibility.value,
    [key]: !current
  }
}

const visibleMainPolylines = computed(() => (
  polylines.value.filter((polyline, index) => isPolylineVisible(getMainPolylineKey(polyline, index)))
))

const visibleSideTripPolylines = computed(() => (
  sideTripPolylines.value.filter((polyline, index) => isPolylineVisible(`side-${polyline.deviceId}-${index}`))
))

function decodeHtml(html: string) {
  const txt = document.createElement('textarea')
  txt.innerHTML = html
  return txt.value
}

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

function getAdjustedTime(dateString: string, adjustmentMinutes: number): string {
  const date = new Date(dateString)
  date.setMinutes(date.getMinutes() + adjustmentMinutes)
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

function getLocationByKey(key: string) {
  return locations.value.find((location) => location.key === key)
}

function updateMarkerPopupContent(locationKey: string) {
  const marker = markerByKey.get(locationKey)
  const location = getLocationByKey(locationKey)
  if (!marker || !location) return
  marker.setPopupContent(popupHtml(location))
}

async function loadWordPressPosts(locationKey: string) {
  try {
    const posts = await $fetch<any[]>(`/api/wordpress/posts/${locationKey}`)
    wordpressPosts.value = {
      ...wordpressPosts.value,
      [locationKey]: posts
    }
  } catch (error) {
    console.error('Error loading WordPress posts:', error)
    wordpressPosts.value = {
      ...wordpressPosts.value,
      [locationKey]: []
    }
  } finally {
    updateMarkerPopupContent(locationKey)
  }
}

async function loadStandstillAdjustment(standstillKey: string) {
  try {
    const response = await $fetch<any>('/api/standstill-adjustments', {
      params: { key: standstillKey }
    })
    if (response.success && response.adjustment) {
      standstillAdjustments.value[standstillKey] = {
        start: response.adjustment.start_adjustment_minutes || 0,
        end: response.adjustment.end_adjustment_minutes || 0
      }
    } else {
      standstillAdjustments.value[standstillKey] = { start: 0, end: 0 }
    }
  } catch (error) {
    console.error('Error loading standstill adjustment:', error)
    standstillAdjustments.value[standstillKey] = { start: 0, end: 0 }
  } finally {
    updateMarkerPopupContent(standstillKey)
  }
}

async function adjustStandstillTime(standstillKey: string, type: 'start' | 'end', delta: number) {
  if (!standstillAdjustments.value[standstillKey]) {
    standstillAdjustments.value[standstillKey] = { start: 0, end: 0 }
  }
  standstillAdjustments.value[standstillKey][type] += delta

  try {
    await $fetch('/api/standstill-adjustments', {
      method: 'POST',
      body: {
        standstillKey,
        startAdjustmentMinutes: standstillAdjustments.value[standstillKey].start,
        endAdjustmentMinutes: standstillAdjustments.value[standstillKey].end
      }
    })
  } catch (error) {
    console.error('Error saving standstill adjustment:', error)
  } finally {
    if (loadedSideTrips.value[standstillKey]) {
      const location = getLocationByKey(standstillKey)
      if (location) {
        await loadStandstillSideTrips(location, true)
      }
    }
    updateMarkerPopupContent(standstillKey)
  }
}

async function resetStandstillAdjustments(standstillKey: string) {
  standstillAdjustments.value[standstillKey] = { start: 0, end: 0 }
  try {
    await $fetch('/api/standstill-adjustments', {
      method: 'POST',
      body: {
        standstillKey,
        startAdjustmentMinutes: 0,
        endAdjustmentMinutes: 0
      }
    })
  } catch (error) {
    console.error('Error resetting standstill adjustment:', error)
  } finally {
    if (loadedSideTrips.value[standstillKey]) {
      const location = getLocationByKey(standstillKey)
      if (location) {
        await loadStandstillSideTrips(location, true)
      }
    }
    updateMarkerPopupContent(standstillKey)
  }
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
      // ignore
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

async function loadStandstillSideTrips(location: any, isReload = false) {
  try {
    loadingSideTrips.value[location.key] = true
    updateMarkerPopupContent(location.key)
    if (isReload) clearSideTrips()

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

    const adjustment = standstillAdjustments.value[location.key] || { start: 0, end: 0 }
    const fromDate = new Date(location.von)
    const toDate = new Date(location.bis)
    if (location.isPOI || location.period === 0) {
      fromDate.setMinutes(fromDate.getMinutes() - 15)
      toDate.setMinutes(toDate.getMinutes() + 15)
    }
    fromDate.setMinutes(fromDate.getMinutes() + adjustment.start)
    toDate.setMinutes(toDate.getMinutes() + adjustment.end)
    const fromAdjusted = fromDate.toISOString().slice(0, 16).replace('T', ' ')
    const toAdjusted = toDate.toISOString().slice(0, 16).replace('T', ' ')
    await fetchSideTrips(fromAdjusted, toAdjusted, deviceIds)
    loadedSideTrips.value[location.key] = true
  } catch (error) {
    console.error('Error loading side trips:', error)
    alert('Failed to load side trips.')
  } finally {
    loadingSideTrips.value[location.key] = false
    updateMarkerPopupContent(location.key)
  }
}

function clearAllSideTrips() {
  clearSideTrips()
  loadedSideTrips.value = {}
}

function openAdjustmentDialog(location: any) {
  currentAdjustmentLocation.value = location
  if (!standstillAdjustments.value[location.key]) {
    standstillAdjustments.value[location.key] = { start: 0, end: 0 }
  }
  adjustmentDialog.value = true
  loadStandstillSideTrips(location)
}

const popupHtml = (location: any) => {
  const posts = wordpressPosts.value[location.key]
  const adjustment = standstillAdjustments.value[location.key] || { start: 0, end: 0 }
  const status = loadingSideTrips.value[location.key]
    ? 'Lade Ausflüge...'
    : (loadedSideTrips.value[location.key] ? 'Ausflüge geladen' : '')

  const postsBlock = posts === undefined
    ? `<div class="osm-muted">Lade Reiseberichte...</div>`
    : posts.length === 0
      ? `<div class="osm-muted">Noch keine Reiseberichte für diesen Ort</div>`
      : `
        <div class="osm-posts">
          ${posts.slice(0, 3).map((post) => `
            <div class="osm-post">
              <a href="${post.link}" target="_blank">${decodeHtml(post.title.rendered)}</a>
              <div class="osm-post-excerpt">
                ${decodeHtml(String(post.excerpt.rendered || '').replace(/<[^>]*>/g, '').substring(0, 140))}...
              </div>
            </div>
          `).join('')}
        </div>
      `

  const details = location?.isPOI
    ? `<div>am: ${new Date(location.von).toLocaleString()}</div>`
    : `<div>von: ${location.von}</div><div>bis: ${location.bis}</div><div>Dauer: ${location.period}h</div>`

  const adjustButton = isAdmin.value
    ? `<button class="osm-btn" data-action="adjust">Zeit anpassen</button>`
    : ''

  const deleteButton = isAdmin.value && location.isPOI
    ? `<button class="osm-btn osm-delete" data-action="delete">POI löschen</button>`
    : ''

  return `
    <div class="osm-popup" data-location-key="${location.key}">
      <h4>${stripPlusCode(String(location?.address || '').split(',')[0] || location?.title || 'Location')}</h4>
      <div class="osm-addr">${location.address || ''}</div>
      ${details}
      <div><a href="${GoogleMapsLink(location.lat, location.lng)}" target="_blank">Link zu Google Maps</a></div>
      <div class="osm-adjust">
        Anpassung: Start ${adjustment.start}m, Ende ${adjustment.end}m
      </div>
      <div class="osm-status">${status}</div>
      <div class="osm-actions">
        <button class="osm-btn" data-action="notes">Notizen</button>
        <button class="osm-btn" data-action="sidetrips">Ausflüge</button>
        <button class="osm-btn" data-action="copy">Marker kopieren</button>
        ${adjustButton}
        ${deleteButton}
      </div>
      <hr class="osm-divider" />
      ${postsBlock}
    </div>
  `
}

const bindPopupActions = (marker: any, location: any) => {
  const clickHandlerKey = '__osmPopupClickHandler'

  marker.on('popupopen', (event: any) => {
    const root = event?.popup?.getElement?.() as HTMLElement | null
    if (!root) return
    loadStandstillAdjustment(location.key)
    loadWordPressPosts(location.key)

    // Delegate clicks from popup root so handlers survive setPopupContent() updates.
    const onPopupClick = async (ev: Event) => {
      const target = ev.target as HTMLElement | null
      const actionEl = target?.closest?.('[data-action]') as HTMLElement | null
      if (!actionEl) return

      ev.preventDefault()
      ev.stopPropagation()
      const action = actionEl.dataset.action

      if (action === 'notes') await openmddialog(location.key)
      if (action === 'sidetrips') await loadStandstillSideTrips(location)
      if (action === 'copy') await copyToClipboard(location.key)
      if (action === 'adjust') openAdjustmentDialog(location)
      if (action === 'delete') await deleteManualPOI(location)
    }

    ;(marker as any)[clickHandlerKey] = onPopupClick
    root.addEventListener('click', onPopupClick)
  })

  marker.on('popupclose', (event: any) => {
    const root = event?.popup?.getElement?.() as HTMLElement | null
    const handler = (marker as any)[clickHandlerKey]
    if (root && handler) {
      root.removeEventListener('click', handler)
    }
    delete (marker as any)[clickHandlerKey]
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
  markerByKey.clear()
  if (!togglemarkers.value) return

  for (const location of locations.value) {
    const marker = L.circleMarker([location.lat, location.lng], {
      radius: location.isPOI ? 7 : 6,
      color: location.isPOI ? '#43A047' : '#E53935',
      weight: 2,
      fillOpacity: 0.9
    })
    marker.bindPopup(popupHtml(location), { maxWidth: 440 })
    bindPopupActions(marker, location)
    markerLayerGroup.addLayer(marker)
    markerByKey.set(location.key, marker)
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

    <div
      v-if="togglepath && sideTripPolylines.length > 0"
      class="leaflet-legend"
    >
      <div class="leaflet-legend-title">
        Routes
        <v-btn
          icon="mdi-close"
          size="x-small"
          variant="text"
          @click="clearAllSideTrips"
          title="Clear side trips"
        ></v-btn>
      </div>
      <div class="leaflet-legend-subtitle">Click to show/hide routes</div>

      <div
        v-for="(polyline, index) in polylines"
        :key="`legend-${getMainPolylineKey(polyline, index)}`"
        class="leaflet-legend-row"
        :style="{ opacity: isPolylineVisible(getMainPolylineKey(polyline, index)) ? 1 : 0.4 }"
        @click="togglePolylineVisibility(getMainPolylineKey(polyline, index))"
      >
        <div
          class="leaflet-legend-line"
          :style="{ backgroundColor: polyline.color, height: `${polyline.lineWeight}px` }"
        ></div>
        <span>
          {{ polyline.deviceName }}
          <span v-if="polyline.isMainDevice" class="leaflet-legend-tag">(main)</span>
        </span>
      </div>

      <div
        v-for="(polyline, index) in sideTripPolylines"
        :key="`legend-side-${polyline.deviceId}-${index}`"
        class="leaflet-legend-row"
        :style="{ opacity: isPolylineVisible(`side-${polyline.deviceId}-${index}`) ? 0.85 : 0.3 }"
        @click="togglePolylineVisibility(`side-${polyline.deviceId}-${index}`)"
      >
        <div
          class="leaflet-legend-line"
          :style="{ backgroundColor: polyline.color, height: `${polyline.lineWeight}px` }"
        ></div>
        <span>
          {{ polyline.deviceName }}
          <span class="leaflet-legend-tag">(side trip)</span>
        </span>
      </div>
    </div>

    <v-dialog v-model="adjustmentDialog" max-width="640">
      <v-card v-if="currentAdjustmentLocation">
        <v-card-title class="text-h6">
          Ausflugszeitraum anpassen
        </v-card-title>
        <v-card-subtitle>
          {{ stripPlusCode(currentAdjustmentLocation.address?.split(',')[0] || '') }}
        </v-card-subtitle>
        <v-card-text>
          <div class="adjust-grid">
            <div>
              <div class="adjust-label">Start</div>
              <div class="adjust-buttons">
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -720)">-12h</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -60)">-1h</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -15)">-15m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -5)">-5m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 5)">+5m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 15)">+15m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 60)">+1h</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 720)">+12h</v-btn>
              </div>
              <div class="adjust-time">{{ getAdjustedTime(currentAdjustmentLocation.von, standstillAdjustments[currentAdjustmentLocation.key]?.start || 0) }}</div>
            </div>

            <div>
              <div class="adjust-label">Ende</div>
              <div class="adjust-buttons">
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -720)">-12h</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -60)">-1h</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -15)">-15m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -5)">-5m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 5)">+5m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 15)">+15m</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 60)">+1h</v-btn>
                <v-btn size="small" variant="outlined" @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 720)">+12h</v-btn>
              </div>
              <div class="adjust-time">{{ getAdjustedTime(currentAdjustmentLocation.bis, standstillAdjustments[currentAdjustmentLocation.key]?.end || 0) }}</div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="resetStandstillAdjustments(currentAdjustmentLocation.key)">Reset</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="loadStandstillSideTrips(currentAdjustmentLocation, true)">Ausflüge neu laden</v-btn>
          <v-btn color="secondary" variant="text" @click="adjustmentDialog = false">Schließen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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

.leaflet-legend {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  background: #fff;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  max-width: 260px;
}

.leaflet-legend-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 4px;
}

.leaflet-legend-subtitle {
  font-size: 11px;
  color: #888;
  margin-bottom: 8px;
}

.leaflet-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 6px;
}

.leaflet-legend-line {
  width: 22px;
  border-radius: 2px;
}

.leaflet-legend-tag {
  color: #888;
  font-size: 12px;
}

.adjust-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.adjust-label {
  font-weight: 600;
  margin-bottom: 8px;
}

.adjust-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.adjust-time {
  margin-top: 8px;
  font-size: 13px;
  color: #37474f;
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

.osm-status {
  margin-top: 6px;
  font-size: 12px;
  color: #1976d2;
}

.osm-adjust {
  margin-top: 6px;
  font-size: 12px;
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

.osm-divider {
  margin: 10px 0;
  border: 0;
  border-top: 1px solid #eceff1;
}

.osm-muted {
  color: #888;
  font-size: 12px;
}

.osm-posts {
  display: grid;
  gap: 8px;
}

.osm-post a {
  color: #1976d2;
  text-decoration: none;
  font-weight: 500;
}

.osm-post-excerpt {
  margin-top: 2px;
  font-size: 12px;
  color: #37474f;
}
</style>
