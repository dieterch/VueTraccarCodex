<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";
import {
  GoogleMap,
  MarkerCluster,
  Marker,
  Polyline,
  InfoWindow,
} from "vue3-google-map";
import { GoogleMapsLink, stripPlusCode } from "~/utils/maps";
import { useMapData } from "~/composables/useMapData";
import { useDocuments } from "~/composables/useDocuments";
import { useAuth } from "~/composables/useAuth";
import MDDialog from "./MDDialog.vue";

const config = useRuntimeConfig();
const maps_api_key = config.public.googleMapsApiKey;
const maps_map_id = config.public.googleMapsMapId;

// Debug logging
console.log('GMap component loaded');
console.log('API Key present:', !!maps_api_key);
console.log('API Key length:', maps_api_key?.length);
console.log('Map ID:', maps_map_id);

const { polygone, polylines, sideTripPolylines, center, zoom, locations, togglemarkers, togglepath, isLoading, loadingMessage, fetchSideTrips, clearSideTrips, poiMode, renderMap } = useMapData();
const { getDocument } = useDocuments();
const { isAdmin } = useAuth();

// Side trip loading state
const loadingSideTrips = ref<Record<string, boolean>>({});

// Track which standstills have loaded side trips
const loadedSideTrips = ref<Record<string, boolean>>({});

// Standstill time adjustments (in minutes)
const standstillAdjustments = ref<Record<string, { start: number, end: number }>>({});

// Time adjustment dialog state
const adjustmentDialog = ref(false);
const currentAdjustmentLocation = ref(null);
const dialogPosition = ref({ x: 0, y: 0 }); // Will be calculated on open
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

// Computed property for responsive InfoWindow sizing (iPhone-only)
const infoWindowWidth = computed(() => {
  const vw = window.innerWidth
  if (vw <= 425) {
    return {
      minWidth: Math.max(280, vw - 50),
      maxWidth: Math.max(300, vw - 25)
    }
  }
  return { minWidth: 300, maxWidth: 350 }
})

// Computed property for responsive dialog width
const dialogWidth = computed(() => {
  const vw = window.innerWidth
  return vw <= 425 ? Math.min(vw * 0.9, 350) : 320
})

// Polyline visibility state
const polylineVisibility = ref<Record<string, boolean>>({});

// Computed: visible polylines
const visiblePolylines = computed(() => {
  return polylines.value.filter((polyline, index) =>
    isPolylineVisible(`main-${polyline.deviceId}`)
  )
})

// Computed: visible side trip polylines
const visibleSideTripPolylines = computed(() => {
  return sideTripPolylines.value.filter((polyline, index) =>
    isPolylineVisible(`side-${polyline.deviceId}-${index}`)
  )
})

// Toggle polyline visibility
function togglePolylineVisibility(key: string) {
  // Ensure reactivity by creating a new object
  const current = polylineVisibility.value[key] ?? true
  polylineVisibility.value = {
    ...polylineVisibility.value,
    [key]: !current
  }
  console.log(`Toggled ${key} visibility:`, polylineVisibility.value[key])
}

// Check if polyline is visible (default: true)
function isPolylineVisible(key: string): boolean {
  const visible = polylineVisibility.value[key]
  return visible === undefined ? true : visible
}

// Debug map state
console.log('Initial map state:', {
  center: center.value,
  zoom: zoom.value,
  polygoneLength: polygone.value?.length
});

const flightPath = ref({
  path: polygone.value,
  geodesic: true,
  strokeColor: "#FF0000",
  strokeOpacity: 1.0,
  strokeWeight: 2,
});

const mapRef = ref(null);

// Track Ctrl/Command key state for independent POI creation
const isCtrlPressed = ref(false);

// Keyboard event handlers (support both Ctrl and Command/Meta keys)
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Meta' || e.metaKey || e.ctrlKey) {
    isCtrlPressed.value = true;
    console.log('🔑 Modifier key pressed:', e.key, { metaKey: e.metaKey, ctrlKey: e.ctrlKey });
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Meta' || (!e.metaKey && !e.ctrlKey)) {
    isCtrlPressed.value = false;
    console.log('🔑 Modifier key released');
  }
}

// Setup keyboard listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

function closeInfoWindows() {
  console.log("closeInfoWindows()");
  locations.value.forEach((location) => {
    location.infowindow = false;
  });
}

// Enhanced map click handler for independent POI creation
async function handleMapClick(event: any) {
  // Check if Ctrl/Command key is pressed (support both Mac Command and Windows/Linux Ctrl)
  const isModifierPressed = event.domEvent?.metaKey || event.domEvent?.ctrlKey || isCtrlPressed.value;

  console.log('🗺️ Map clicked:', {
    poiMode: poiMode.value,
    metaKey: event.domEvent?.metaKey,
    ctrlKey: event.domEvent?.ctrlKey,
    isCtrlPressed: isCtrlPressed.value,
    hasLatLng: !!event.latLng
  });

  // If POI Mode is ON and Ctrl/Command is pressed, create independent POI
  if (poiMode.value && isModifierPressed && event.latLng) {
    const clickedLat = event.latLng.lat();
    const clickedLng = event.latLng.lng();
    console.log('🎯 Creating independent POI at:', clickedLat, clickedLng);
    await createIndependentPOI(clickedLat, clickedLng);
    return;
  }

  // Otherwise, close info windows
  closeInfoWindows();
}

const mddialog = ref(false);
const mode = ref("light");
const content = ref("");
const file = ref("");
const wordpressPosts = ref({});
const copiedKey = ref(null);

async function openmddialog(key) {
  console.log("openmddialog", key);
  content.value = await getDocument(key);
  file.value = key;
  mddialog.value = true;
}

async function loadWordPressPosts(locationKey) {
  console.log("🔍 Loading posts for:", locationKey);

  try {
    const posts = await $fetch(`/api/wordpress/posts/${locationKey}`);
    
    wordpressPosts.value = {
      ...wordpressPosts.value,
      [locationKey]: posts,
      [locationKey.toLowerCase()]: posts
    };
    
    console.log("✅ Loaded", posts.length, "posts");
    
  } catch (error) {
    console.error("❌ Error:", error);
    wordpressPosts.value = {
      ...wordpressPosts.value,
      [locationKey]: [],
      [locationKey.toLowerCase()]: []
    };
  }
}

async function handleMarkerClick(location) {
  closeInfoWindows();
  location.infowindow = true;

  // Load adjustments and posts in parallel
  loadStandstillAdjustment(location.key);
  loadWordPressPosts(location.key);

  if (mapRef.value?.map) {
    const map = mapRef.value.map;

    // Schritt 1: Zentriere auf Marker
    map.panTo({
      lat: location.lat,
      lng: location.lng
    });

    // Schritt 2: Warte bis InfoWindow gerendert ist
    await new Promise(resolve => setTimeout(resolve, 350));

    // Schritt 3: Verschiebe Marker nach unten (InfoWindow bleibt sichtbar)
    map.panBy(0, -120);
  }
}

// Load side trips for a specific standstill
// Load standstill adjustment from database
async function loadStandstillAdjustment(standstillKey: string) {
  try {
    const response = await $fetch('/api/standstill-adjustments', {
      params: { key: standstillKey }
    })
    if (response.success && response.adjustment) {
      standstillAdjustments.value[standstillKey] = {
        start: response.adjustment.start_adjustment_minutes || 0,
        end: response.adjustment.end_adjustment_minutes || 0
      }
    }
  } catch (error) {
    console.error('Error loading standstill adjustment:', error)
    // Initialize with defaults
    standstillAdjustments.value[standstillKey] = { start: 0, end: 0 }
  }
}

// Calculate safe initial position for dialog (centered, accessible on mobile)
function calculateDialogPosition() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // iPhone-specific responsive width
  const dialogWidth = viewportWidth <= 425
    ? Math.min(viewportWidth * 0.9, 350)
    : 320
  const dialogHeight = 400

  // Center horizontally
  const x = Math.max(20, (viewportWidth - dialogWidth) / 2)

  // iPhone-only: Account for safe areas (notch, Dynamic Island)
  let y = Math.max(100, viewportHeight * 0.25)
  if (viewportWidth <= 425) {
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--sat') || '0') || 44
    y = Math.max(safeAreaTop + 60, viewportHeight * 0.25)
  }

  return { x, y }
}

// Open adjustment dialog
function openAdjustmentDialog(location) {
  currentAdjustmentLocation.value = location
  dialogPosition.value = calculateDialogPosition()
  adjustmentDialog.value = true
}

// Drag handlers for floating dialog (supports both mouse and touch)
function startDrag(event: MouseEvent | TouchEvent) {
  event.preventDefault()
  isDragging.value = true

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  dragOffset.value = {
    x: clientX - dialogPosition.value.x,
    y: clientY - dialogPosition.value.y
  }

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

function onDrag(event: MouseEvent | TouchEvent) {
  if (isDragging.value) {
    if ('touches' in event) {
      event.preventDefault()
      event.stopPropagation() // Prevent scroll interference
    }

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

    // Keep dialog within viewport bounds - use responsive width
    const dialogWidth = window.innerWidth <= 425
      ? Math.min(window.innerWidth * 0.9, 350)
      : 320
    const dialogHeight = 400
    const maxX = window.innerWidth - dialogWidth
    const maxY = window.innerHeight - dialogHeight

    dialogPosition.value = {
      x: Math.max(0, Math.min(maxX, clientX - dragOffset.value.x)),
      y: Math.max(0, Math.min(maxY, clientY - dragOffset.value.y))
    }
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

// Adjust start or end time
async function adjustStandstillTime(standstillKey: string, type: 'start' | 'end', delta: number) {
  if (!standstillAdjustments.value[standstillKey]) {
    standstillAdjustments.value[standstillKey] = { start: 0, end: 0 }
  }

  const adjustment = standstillAdjustments.value[standstillKey]
  adjustment[type] += delta

  // Save to database
  try {
    await $fetch('/api/standstill-adjustments', {
      method: 'POST',
      body: {
        standstillKey,
        startAdjustmentMinutes: adjustment.start,
        endAdjustmentMinutes: adjustment.end
      }
    })

    // Auto-reload side trips if they were already loaded for this standstill
    if (loadedSideTrips.value[standstillKey]) {
      const location = locations.value.find(loc => loc.key === standstillKey)
      if (location) {
        await loadStandstillSideTrips(location, true)
      }
    }
  } catch (error) {
    console.error('Error saving standstill adjustment:', error)
  }
}

// Reset adjustments to zero
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

    // Auto-reload side trips if they were already loaded for this standstill
    if (loadedSideTrips.value[standstillKey]) {
      const location = locations.value.find(loc => loc.key === standstillKey)
      if (location) {
        await loadStandstillSideTrips(location, true)
      }
    }
  } catch (error) {
    console.error('Error resetting standstill adjustment:', error)
  }
}

// Get adjusted time string
function getAdjustedTime(dateString: string, adjustmentMinutes: number): string {
  const date = new Date(dateString)
  date.setMinutes(date.getMinutes() + adjustmentMinutes)
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

// Wrapper for clearSideTrips to also clear tracking
function clearAllSideTrips() {
  clearSideTrips()
  loadedSideTrips.value = {}
}

async function loadStandstillSideTrips(location, isReload = false) {
  try {
    loadingSideTrips.value[location.key] = true

    // If reloading (after adjustment), clear existing side trips first
    if (isReload) {
      clearSideTrips()
    }

    // Get enabled side trip devices from side trips config (user-safe)
    const settingsResponse = await $fetch('/api/side-trips/config')
    if (!settingsResponse.success || !settingsResponse.settings.sideTripEnabled) {
      alert('Side trip tracking is not enabled. Please enable it in settings first.')
      return
    }

    const deviceIds = settingsResponse.settings.sideTripDevices
      ?.filter(d => d.enabled)
      .map(d => d.deviceId) || []

    if (deviceIds.length === 0) {
      alert('No secondary devices configured. Please add devices in settings.')
      return
    }

    // Get stored adjustments for this specific standstill/POI
    const adjustment = standstillAdjustments.value[location.key] || { start: 0, end: 0 }

    const fromDate = new Date(location.von)
    const toDate = new Date(location.bis)

    // NEW: If this is a POI (period = 0 or isPOI flag), apply default ±15 minute window
    if (location.isPOI || location.period === 0) {
      fromDate.setMinutes(fromDate.getMinutes() - 15)  // -15 minutes from timestamp
      toDate.setMinutes(toDate.getMinutes() + 15)      // +15 minutes from timestamp
      console.log(`📍 POI detected: applying default ±15 minute window`)
    }

    // Apply user adjustments on top of the default window (for POIs) or original times (for standstills)
    fromDate.setMinutes(fromDate.getMinutes() + adjustment.start)
    toDate.setMinutes(toDate.getMinutes() + adjustment.end)

    const fromAdjusted = fromDate.toISOString().slice(0, 16).replace('T', ' ')
    const toAdjusted = toDate.toISOString().slice(0, 16).replace('T', ' ')

    console.log(`🚴 Loading side trips for ${location.key}`)
    console.log(`   Original period: ${location.von} to ${location.bis}`)
    if (location.isPOI || location.period === 0) {
      console.log(`   Default POI window: ±15 minutes`)
    }
    console.log(`   User adjustments: start ${adjustment.start}min, end ${adjustment.end}min`)
    console.log(`   Final period: ${fromAdjusted} to ${toAdjusted}`)
    console.log(`   Devices:`, deviceIds)

    await fetchSideTrips(fromAdjusted, toAdjusted, deviceIds)

    // Mark this standstill as having loaded side trips
    loadedSideTrips.value[location.key] = true

    console.log(`✅ Side trips loaded for ${location.key}`)
    console.log(`   sideTripPolylines.value now has ${sideTripPolylines.value.length} polylines`)
    if (sideTripPolylines.value.length > 0) {
      console.log(`   First polyline:`, sideTripPolylines.value[0])
      console.log(`   Path length:`, sideTripPolylines.value[0].path.length)
    }
  } catch (error) {
    console.error('Error loading side trips:', error)
    alert('Failed to load side trips. Check console for details.')
  } finally {
    loadingSideTrips.value[location.key] = false
  }
}

function copyToClipboard(key) {
  console.log("📋 Attempting to copy:", key);

  try {
    // Method 1: Select from input field and copy
    const input = document.getElementById('key-' + key);
    if (input) {
      input.select();
      input.setSelectionRange(0, 99999); // For mobile devices

      const success = document.execCommand('copy');
      if (success) {
        console.log("✅ Copied with execCommand from input");
      } else {
        throw new Error('execCommand failed');
      }
    } else {
      // Method 2: Fallback to textarea
      const textarea = document.createElement('textarea');
      textarea.value = key;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (!success) {
        throw new Error('execCommand failed');
      }
      console.log("✅ Copied with execCommand fallback");
    }

    // Update UI state
    copiedKey.value = key;

    // Reset after 2 seconds
    setTimeout(() => {
      copiedKey.value = null;
      console.log("🔄 Reset copied state");
    }, 2000);

  } catch (error) {
    console.error("❌ Failed to copy:", error);
    alert(`Konnte Key nicht kopieren: ${key}\nBitte manuell kopieren oder im Textfeld markieren und Strg+C drücken.`);
  }
}

// Get marker icon based on location type
function getMarkerIcon(location: any) {
  if (location.isPOI) {
    return {
      path: 0, // google.maps.SymbolPath.CIRCLE
      fillColor: '#4CAF50',  // Green
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
      scale: 10
    }
  }
  return undefined  // Default red pin for standstills
}

// POI Creation Functions
async function handlePolylineClick(event: any, polyline: any) {
  if (!poiMode.value) return

  const clickedLat = event.latLng.lat()
  const clickedLng = event.latLng.lng()

  // Find nearest position in polyline path
  const nearest = findNearestPosition(clickedLat, clickedLng, polyline.path)

  if (nearest && nearest.timestamp) {
    await createManualPOI(clickedLat, clickedLng, nearest.timestamp, polyline.deviceId)
  } else {
    alert('Could not determine timestamp for this location')
  }
}

function findNearestPosition(lat: number, lng: number, path: any[]) {
  let minDist = Infinity
  let nearest = null

  for (const pos of path) {
    const dist = Math.sqrt(
      Math.pow(pos.lat - lat, 2) +
      Math.pow(pos.lng - lng, 2)
    )
    if (dist < minDist) {
      minDist = dist
      nearest = pos
    }
  }

  return nearest
}

async function createManualPOI(lat: number, lng: number, timestamp: string, deviceId: number) {
  try {
    isLoading.value = true
    loadingMessage.value = 'Creating POI...'

    // NEW: Capture current map state before reload
    let currentZoom = null
    let currentCenter = null
    if (mapRef.value?.map) {
      currentZoom = mapRef.value.map.getZoom()
      currentCenter = mapRef.value.map.getCenter()
      console.log('💾 Saved map state:', { zoom: currentZoom, center: currentCenter?.toJSON() })
    }

    // Generate POI key
    const key = `marker${String(lat).substring(0, 7)}${String(lng).substring(0, 7)}`
      .replace(/\./g, '')
      .replace(/-/g, 'M')

    // Reverse geocode
    const { country, address } = await reverseGeocodePOI(lat, lng)

    // Save POI
    await $fetch('/api/manual-pois', {
      method: 'POST',
      body: { lat, lng, timestamp, deviceId, address, country, key }
    })

    // Reload map (this will reset zoom/center)
    await renderMap()

    // NEW: Restore map state after reload
    await nextTick()  // Wait for map to update
    if (mapRef.value?.map && currentZoom && currentCenter) {
      mapRef.value.map.setZoom(currentZoom)
      mapRef.value.map.setCenter(currentCenter)
      console.log('🔄 Restored map state:', { zoom: currentZoom })
    }

    console.log('✅ POI created:', key)
  } catch (error) {
    console.error('Error creating POI:', error)
    alert('Fehler beim Erstellen des POI')
  } finally {
    isLoading.value = false
  }
}

async function reverseGeocodePOI(lat: number, lng: number) {
  const apiKey = config.public.googleMapsApiKey

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    const response = await $fetch(url)

    if (response.status === 'OK' && response.results.length > 0) {
      const result = response.results[0]
      const countryComponent = result.address_components.find(comp =>
        comp.types.includes('country')
      )

      return {
        country: countryComponent?.long_name || 'Unknown',
        address: result.formatted_address
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error)
  }

  return {
    country: 'Unknown',
    address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

// Find nearest point across ALL polylines (for independent POI creation)
function findNearestPolylinePoint(lat: number, lng: number) {
  let minDist = Infinity
  let nearest = null

  // Search through all visible polylines
  for (const polyline of polylines.value) {
    if (!polyline.path) continue

    for (const pos of polyline.path) {
      const dist = Math.sqrt(
        Math.pow(pos.lat - lat, 2) +
        Math.pow(pos.lng - lng, 2)
      )
      if (dist < minDist) {
        minDist = dist
        nearest = { ...pos, deviceId: polyline.deviceId }
      }
    }
  }

  return nearest
}

// Create independent POI (not restricted to polyline click)
async function createIndependentPOI(lat: number, lng: number) {
  const nearest = findNearestPolylinePoint(lat, lng)

  if (!nearest || !nearest.timestamp) {
    alert('Could not find nearby route. Please click closer to a route or ensure a route is displayed.')
    return
  }

  console.log(`📍 Creating independent POI at (${lat.toFixed(6)}, ${lng.toFixed(6)})`)
  console.log(`   Using timestamp from nearest point: ${nearest.timestamp}`)
  console.log(`   Device ID: ${nearest.deviceId}`)

  await createManualPOI(lat, lng, nearest.timestamp, nearest.deviceId)
}

// Delete POI
async function deleteManualPOI(location: any) {
  const addressShort = location.address.split(',')[0]
  if (!confirm(`POI "${addressShort}" und zugehörige Anpassungen löschen?`)) {
    return
  }

  try {
    isLoading.value = true
    loadingMessage.value = 'Lösche POI...'

    // Delete standstill adjustments (ignore if none exist)
    try {
      await $fetch(`/api/standstill-adjustments/${location.key}`, { method: 'DELETE' })
    } catch (err) {
      console.log('No adjustments to delete')
    }

    // Delete POI
    await $fetch(`/api/manual-pois/${location.poiId}`, { method: 'DELETE' })

    // Clear side trips if loaded
    clearSideTrips()

    // Reload map
    await renderMap()

    console.log('✅ POI deleted')
  } catch (error) {
    console.error('Error deleting POI:', error)
    alert('Fehler beim Löschen des POI')
  } finally {
    isLoading.value = false
  }
}

function decodeHtml(html) {
  const txt = document.createElement("textarea")
  txt.innerHTML = html
  return txt.value
}

</script>

<template>
  <div style="width: 100%; height: calc(100vh - 48px); position: relative;">
    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(2px);"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="64"
        width="6"
      ></v-progress-circular>
      <div style="margin-top: 20px; font-size: 1.1em; font-weight: 500; color: #1976d2;">
        {{ loadingMessage }}
      </div>
      <div style="margin-top: 8px; font-size: 0.85em; color: #666; max-width: 400px; text-align: center;">
        This may take a moment for side trips during long travel periods
      </div>
    </div>

    <!-- Debug info -->
    <div v-if="!maps_api_key" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 2px solid red; z-index: 1000;">
      <h2>Google Maps API Key Missing!</h2>
      <p>Please check your .env file and ensure NUXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.</p>
    </div>

    <GoogleMap
      v-if="maps_api_key"
      ref="mapRef"
      :api-key="maps_api_key"
      :map-id="maps_map_id"
      style="width: 100%; height: 100%"
      :center="center"
      :zoom="zoom"
      @click="handleMapClick"
    >
    <!-- Render main device polylines -->
    <template v-if="togglepath && visiblePolylines.length > 0">
      <Polyline
        v-for="(polyline, index) in visiblePolylines"
        :key="`polyline-${polyline.deviceId}-${index}`"
        :options="{
          path: polyline.path,
          geodesic: true,
          strokeColor: polyline.color,
          strokeOpacity: 1.0,
          strokeWeight: polyline.lineWeight,
          clickable: true,
          zIndex: polyline.isMainDevice ? 100 : 50
        }"
        @click="(e) => handlePolylineClick(e, polyline)"
      />
    </template>

    <!-- Render side trip polylines -->
    <template v-if="togglepath && visibleSideTripPolylines.length > 0">
      <Polyline
        v-for="(polyline, index) in visibleSideTripPolylines"
        :key="`sidetrip-${polyline.deviceId}-${index}`"
        :options="{
          path: polyline.path,
          geodesic: true,
          strokeColor: polyline.color,
          strokeOpacity: 0.8,
          strokeWeight: polyline.lineWeight,
          zIndex: 75
        }"
      />
    </template>

    <!-- Fallback to single polyline (backward compatibility) -->
    <Polyline v-else-if="togglepath && polygone.length > 0" :options="flightPath" />

    <!-- Legend for multiple routes -->
    <div
      v-if="togglepath && (polylines.length > 1 || sideTripPolylines.length > 0)"
      style="position: absolute; top: 10px; right: 10px; background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 1000; max-width: 250px;"
    >
      <div style="font-weight: 600; font-size: 0.9em; margin-bottom: 4px; color: #333;">
        Routes
        <v-btn
          v-if="sideTripPolylines.length > 0"
          icon="mdi-close"
          size="x-small"
          variant="text"
          @click="clearAllSideTrips"
          style="float: right;"
          title="Clear side trips"
        ></v-btn>
      </div>
      <div style="font-size: 0.7em; color: #999; margin-bottom: 8px; font-style: italic;">
        Click to show/hide routes
      </div>

      <!-- Main routes -->
      <div
        v-for="polyline in polylines"
        :key="`legend-${polyline.deviceId}`"
        @click="togglePolylineVisibility(`main-${polyline.deviceId}`)"
        :style="{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '6px',
          fontSize: '0.85em',
          cursor: 'pointer',
          padding: '4px 6px',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          opacity: isPolylineVisible(`main-${polyline.deviceId}`) ? 1 : 0.4,
          transition: 'all 0.2s'
        }"
        :title="isPolylineVisible(`main-${polyline.deviceId}`) ? 'Click to hide' : 'Click to show'"
      >
        <div
          :style="{
            width: '20px',
            height: polyline.lineWeight + 'px',
            backgroundColor: polyline.color,
            marginRight: '8px',
            borderRadius: '2px'
          }"
        ></div>
        <span style="color: #666;">
          {{ polyline.deviceName }}
          <span v-if="polyline.isMainDevice" style="color: #999; font-size: 0.9em;">(main)</span>
        </span>
        <v-icon
          :icon="isPolylineVisible(`main-${polyline.deviceId}`) ? 'mdi-eye' : 'mdi-eye-off'"
          size="x-small"
          style="margin-left: auto; opacity: 0.5;"
        ></v-icon>
      </div>

      <!-- Side trip routes -->
      <div
        v-for="(polyline, index) in sideTripPolylines"
        :key="`legend-side-${polyline.deviceId}-${index}`"
        @click="togglePolylineVisibility(`side-${polyline.deviceId}-${index}`)"
        :style="{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '6px',
          fontSize: '0.85em',
          cursor: 'pointer',
          padding: '4px 6px',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          opacity: isPolylineVisible(`side-${polyline.deviceId}-${index}`) ? 0.8 : 0.3,
          transition: 'all 0.2s'
        }"
        :title="isPolylineVisible(`side-${polyline.deviceId}-${index}`) ? 'Click to hide' : 'Click to show'"
      >
        <div
          :style="{
            width: '20px',
            height: polyline.lineWeight + 'px',
            backgroundColor: polyline.color,
            marginRight: '8px',
            borderRadius: '2px'
          }"
        ></div>
        <span style="color: #666;">
          {{ polyline.deviceName }}
          <span style="color: #999; font-size: 0.9em;">(side trip)</span>
        </span>
        <v-icon
          :icon="isPolylineVisible(`side-${polyline.deviceId}-${index}`) ? 'mdi-eye' : 'mdi-eye-off'"
          size="x-small"
          style="margin-left: auto; opacity: 0.5;"
        ></v-icon>
      </div>
    </div>

    <MarkerCluster v-if="togglemarkers">
      <Marker
        v-for="(location, i) in locations"
        :key="i"
        :options="{
          position: location,
          icon: getMarkerIcon(location),
          clickable: true,
          optimized: false
        }"
        @click="handleMarkerClick(location)"
      >
        <InfoWindow
          :options="{
            position: location,
            ...infoWindowWidth
          }"
          v-model="location.infowindow"
        >
          <div id="content" style="padding: 4px 8px 8px 4px;">
            <div id="siteNotice"></div>
            <h2>{{ stripPlusCode(location.address.split(",")[0]) }}</h2>
            <div id="bodyContent">
              <h4 v-for="(line, i) in location.address.split(',').slice(1)" :key="i">{{ line }}</h4>
              
              <p><a target="_blank" :href="GoogleMapsLink(location.lat, location.lng)">Link zu Google Maps</a></p>

              <table style="width: 100%; text-align: left; margin-top: 5px">
                <tbody>
                  <tr>
                    <th>Lat, Lng</th>
                    <td>{{ location.lat.toFixed(2) }}, {{ location.lng.toFixed(2) }}</td>
                  </tr>
                  <tr>
                    <th>von</th>
                    <td>{{ location.von }}</td>
                  </tr>
                  <tr>
                    <th>bis</th>
                    <td>{{ location.bis }}</td>
                  </tr>
                  <tr>
                    <th>Dauer</th>
                    <td>{{ location.period }}h</td>
                  </tr>
                </tbody>
              </table>

              <div style="margin-top: 15px; border-top: 2px solid #1976d2; padding-top: 15px">
                <h3 style="margin: 0 0 12px 0; font-size: 1.1em; color: #1976d2">Reiseberichte</h3>

                <div v-if="wordpressPosts[location.key] && wordpressPosts[location.key].length > 0">
                  <div v-for="post in wordpressPosts[location.key].slice(0, 3)" :key="post.id" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 0px solid #e0e0e0">
                    <h4 style="margin: 0 0 5px 0; font-size: 1em">
                      <a :href="post.link" target="_blank" style="color: #1976d2; text-decoration: none; font-weight: 500">{{ decodeHtml(post.title.rendered) }}</a>
                    </h4>
                    <!-- div style="font-size: 0.85em; color: #666; margin-bottom: 5px">{{ new Date(post.date).toLocaleDateString("de-DE") }}</div-->
                    <div style="font-size: 0.9em; line-height: 1.4; color: #333">{{ decodeHtml(post.excerpt.rendered.replace(/<[^>]*>/g, '').substring(0, 150)) }}...</div>
                  </div>

                  <div v-if="wordpressPosts[location.key].length > 3">
                    <a :href="wordpressPosts[location.key][0].link" target="_blank" style="font-size: 0.9em; color: #1976d2; text-decoration: none">→ Alle {{ wordpressPosts[location.key].length }} Beiträge ansehen</a>
                  </div>
                </div>

                <div v-else-if="wordpressPosts[location.key] && wordpressPosts[location.key].length === 0" style="font-style: italic; color: #999; font-size: 0.9em">Noch keine Reiseberichte für diesen Ort</div>

                <div v-else style="font-style: italic; color: #999; font-size: 0.9em">Lade Reiseberichte...</div>
              </div>

              <div style="margin-top: 15px; border-top: 2px solid #ddd; padding-top: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 6px;">

                  <v-btn color="primary" size="small" @click="openmddialog(location.key)">
                    <v-icon icon="mdi-notebook-edit" size="small"></v-icon>
                      <v-tooltip
                        activator="parent"
                        location="top"
                      >Notizen</v-tooltip>
                  </v-btn>


                  <v-btn
                    v-if="isAdmin"
                    color="warning"
                    size="small"
                    @click.stop="openAdjustmentDialog(location)"
                  >
                    <v-icon icon="mdi-clock-edit" size="small"></v-icon>
                    {{ (standstillAdjustments[location.key]?.start || standstillAdjustments[location.key]?.end) ? '⚙️' : '' }}
                    <v-tooltip
                        activator="parent"
                        location="top"
                      >Stillstandszeit anpassen</v-tooltip>
                  </v-btn>

                  <v-btn
                    color="success"
                    size="small"
                    @click.stop="loadStandstillSideTrips(location)"
                    :loading="loadingSideTrips[location.key]"
                    :disabled="loadingSideTrips[location.key]"
                  >
                    <v-icon icon="mdi-bicycle" size="small"></v-icon>
                      <v-tooltip
                        activator="parent"
                        location="top"
                      >Ausflüge anzeigen</v-tooltip>
                  </v-btn>

                  <v-btn
                    v-if="isAdmin"
                    color="grey-darken-2"
                    variant="outlined"
                    size="small"
                    @click.stop="copyToClipboard(location.key)"
                  >
                    <v-icon icon="mdi-content-copy" size="small"></v-icon>
                      <v-tooltip
                        activator="parent"
                        location="top"
                      >Wordpress Marker kopieren</v-tooltip>
                  </v-btn>
                  
                  <!-- POI Delete Section -->
                    <v-btn
                    v-if="isAdmin && location.isPOI"
                    block
                    color="error"
                    size="small"
                    @click="deleteManualPOI(location)"
                    >
                    <v-icon icon="mdi-delete" size="small"></v-icon>
                      <v-tooltip
                        activator="parent"
                        location="top"
                      >POI löschen</v-tooltip>
                  </v-btn>
                <!--/div-->
              </div>
              </div>
            </div>
          </div>
        </InfoWindow>
      </Marker>
    </MarkerCluster>
    </GoogleMap>

    <!-- Compact Draggable Time Adjustment Panel -->
    <div
      v-if="adjustmentDialog && currentAdjustmentLocation"
      :style="{
        position: 'fixed',
        left: `${dialogPosition.x}px`,
        top: `${dialogPosition.y}px`,
        zIndex: 1000,
        width: `${dialogWidth}px`,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        border: '2px solid #ff9800',
        cursor: isDragging ? 'grabbing' : 'default'
      }"
    >
      <!-- Draggable Header -->
      <div
        @mousedown="startDrag"
        @touchstart="startDrag"
        style="
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          padding: 8px 12px;
          border-radius: 6px 6px 0 0;
          cursor: grab;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
          touch-action: none;
        "
      >
        <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;">
          <v-icon icon="mdi-clock-edit" size="small" color="white"></v-icon>
          Ausflugszeitraum anpassen
        </div>
        <v-icon
          icon="mdi-close"
          size="small"
          color="white"
          @click.stop="adjustmentDialog = false"
          @mousedown.stop
          @touchstart.stop
          style="cursor: pointer;"
        ></v-icon>
      </div>

      <!-- Content -->
      <div style="padding: 12px; font-size: 13px;">
        <!-- Location Name -->
        <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
          {{ stripPlusCode(currentAdjustmentLocation.address.split(",")[0]) }}
        </div>

        <!-- Start Time -->
        <div style="margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
            <v-icon icon="mdi-clock-start" size="x-small" color="primary"></v-icon>
            <span style="font-weight: 500; font-size: 12px;">Start</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 4px;">
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -720)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-12h</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -60)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-1h</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -15)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-15m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', -5)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-5m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 5)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >5m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 15)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+15m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 60)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+1h</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'start', 720)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+12h</button>
          </div>
          <div style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; text-align: center; font-size: 12px;">
            {{ getAdjustedTime(currentAdjustmentLocation.von, standstillAdjustments[currentAdjustmentLocation.key]?.start || 0) }}
            <span v-if="standstillAdjustments[currentAdjustmentLocation.key]?.start" style="color: #1976d2; font-weight: 600;">
              ({{ standstillAdjustments[currentAdjustmentLocation.key].start > 0 ? '+' : '' }}{{ standstillAdjustments[currentAdjustmentLocation.key].start }}m)
            </span>
          </div>
        </div>

        <!-- End Time -->
        <div style="margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
            <v-icon icon="mdi-clock-end" size="x-small" color="error"></v-icon>
            <span style="font-weight: 500; font-size: 12px;">Ende</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 4px;">
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -720)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-12h</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -60)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-1h</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -15)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-15m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', -5)"
              style="padding: 4px; font-size: 11px; border: 1px solid #f44336; background: white; color: #f44336; border-radius: 4px; cursor: pointer;"
            >-5m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 5)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+5m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 15)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+15m</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 60)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+1h</button>
            <button
              @click="adjustStandstillTime(currentAdjustmentLocation.key, 'end', 720)"
              style="padding: 4px; font-size: 11px; border: 1px solid #4caf50; background: white; color: #4caf50; border-radius: 4px; cursor: pointer;"
            >+12h</button>
          </div>
          <div style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; text-align: center; font-size: 12px;">
            {{ getAdjustedTime(currentAdjustmentLocation.bis, standstillAdjustments[currentAdjustmentLocation.key]?.end || 0) }}
            <span v-if="standstillAdjustments[currentAdjustmentLocation.key]?.end" style="color: #1976d2; font-weight: 600;">
              ({{ standstillAdjustments[currentAdjustmentLocation.key].end > 0 ? '+' : '' }}{{ standstillAdjustments[currentAdjustmentLocation.key].end }}m)
            </span>
          </div>
        </div>

        <!-- Status/Actions -->
        <div style="display: flex; gap: 4px; align-items: center;">
          <button
            v-if="standstillAdjustments[currentAdjustmentLocation.key]?.start || standstillAdjustments[currentAdjustmentLocation.key]?.end"
            @click="resetStandstillAdjustments(currentAdjustmentLocation.key)"
            style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #ff9800; background: white; color: #ff9800; border-radius: 4px; cursor: pointer; font-weight: 600;"
          >
            ↻ Reset
          </button>
          <div
            v-if="loadedSideTrips[currentAdjustmentLocation.key]"
            style="flex: 1; background: #c8e6c9; padding: 6px; border-radius: 4px; text-align: center; font-size: 11px; color: #2e7d32; font-weight: 600;"
          >
            ✓ Auto-Update
          </div>
        </div>
      </div>
    </div>

    <MDDialog :content="content" :file="file" :mode="mode" :key="mddialog" :dialog="mddialog" @dialog="(e) => { mddialog = e; }" />
  </div>
</template>

<style>
/* Safe area support for iPhone notch/Dynamic Island */
:root {
  --sat: env(safe-area-inset-top);
  --sar: env(safe-area-inset-right);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
}

/* InfoWindow Styling - Größe begrenzen */
:deep(.gm-style-iw) {
  max-width: 350px !important;
  max-height: 60vh !important;
}

:deep(.gm-style-iw-c) {
  max-width: 350px !important;
  max-height: 60vh !important;
  padding: 12px !important;
}

:deep(.gm-style-iw-d) {
  max-height: calc(60vh - 60px) !important;
  overflow-y: auto !important;
}

/* Extra padding for mobile/tablet devices (Safari/iPad needs this) */
/* Using both touch detection and viewport width for better iPad detection */
@media (pointer: coarse) and (hover: none) {
  :deep(.gm-style-iw-c) {
    padding: 14px 14px 18px 14px !important;
  }

  :deep(.gm-style-iw-d) {
    overflow-y: auto !important;
  }
}

@media (max-width: 1024px) and (min-width: 768px) {
  :deep(.gm-style-iw-c) {
    padding: 14px 14px 18px 14px !important;
  }
}

/* Scrollbar */
:deep(.gm-style-iw-d::-webkit-scrollbar) {
  width: 6px;
}

:deep(.gm-style-iw-d::-webkit-scrollbar-track) {
  background: #f1f1f1;
  border-radius: 3px;
}

:deep(.gm-style-iw-d::-webkit-scrollbar-thumb) {
  background: #1976d2;
  border-radius: 3px;
}

:deep(.gm-style-iw-d::-webkit-scrollbar-thumb:hover) {
  background: #1565c0;
}

/* Ensure InfoWindow content has proper padding */
:deep(.gm-style-iw-d #content) {
  padding-right: 8px !important;
  padding-bottom: 10px !important;
}

/* Additional padding for touch devices (iPad, tablets) */
@media (pointer: coarse) and (hover: none) {
  :deep(.gm-style-iw-d #content) {
    padding-right: 12px !important;
    padding-bottom: 14px !important;
  }
}

/* ===== iPhone-specific optimizations - NO IMPACT on iPad/Desktop ===== */

/* Priority 3: Increase touch targets to meet iOS HIG 44x44pt minimum */
@media (max-width: 425px) {
  /* Time adjustment dialog buttons */
  div[style*="position: fixed"] button {
    padding: 10px 8px !important;
    font-size: 13px !important;
    min-height: 40px !important;
  }

  /* Increase button grid gap */
  div[style*="position: fixed"] div[style*="grid-template-columns"] {
    gap: 8px !important;
  }

  /* Priority 5: Increase font sizes for iPhone readability */
  div[style*="position: fixed"] [style*="font-size: 14px"] {
    font-size: 15px !important;
  }

  div[style*="position: fixed"] [style*="font-size: 13px"] {
    font-size: 14px !important;
  }

  div[style*="position: fixed"] [style*="font-size: 12px"] {
    font-size: 13px !important;
  }

  /* InfoWindow content font size */
  :deep(.gm-style-iw-d #content) {
    font-size: 14px !important;
    line-height: 1.5 !important;
  }

  /* InfoWindow sizing for small phones */
  :deep(.gm-style-iw) {
    max-width: calc(100vw - 40px) !important;
  }

  :deep(.gm-style-iw-c) {
    max-width: calc(100vw - 40px) !important;
  }
}

/* Priority 4: Responsive button grid layout for very small iPhones */
@media (max-width: 400px) {
  /* 2-column button layout for iPhone SE and similar */
  :deep(.gm-style-iw-d #bodyContent > div:last-child > div) {
    grid-template-columns: 1fr 1fr !important;
    gap: 8px !important;
  }
}
</style>
