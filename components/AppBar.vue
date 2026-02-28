<script setup>
import { ref, onMounted, computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useTraccar } from '~/composables/useTraccar';
import { useMapData } from '~/composables/useMapData';
import { useAuth } from '~/composables/useAuth';
import { useTravelCache } from '~/composables/useTravelCache';
import { useMapProvider } from '~/composables/useMapProvider';

const { startdate, stopdate, travel, travels, selectedTravels, setSelectedTravels, getTravels, downloadKml, rebuildCache, checkCacheStatus, prefetchRoute, device } = useTraccar();
const {
    distance,
    renderMap,
    settingsdialog,
    configdialog,
    aboutdialog,
    poiMode,
    manualtraveldialog,
    liveMode,
    livePollingIntervalMs,
    livePollingInFlight,
    setLiveModeEnabled,
    setLivePollingInterval
} = useMapData();
const config = useRuntimeConfig();
const { isAdmin, authState } = useAuth();
const { isOffline, usingCachedTravel, cachedTravelUpdatedAt } = useTravelCache();
const { mapProvider, mapAdapters, setMapProvider } = useMapProvider();
const { smAndDown } = useDisplay();

const prefetching = ref(false);
const liveIntervalOptions = [
    { title: '15s', value: 15000 },
    { title: '30s', value: 30000 },
    { title: '60s', value: 60000 },
    { title: '120s', value: 120000 }
];
const cachedTravelUpdatedLabel = computed(() => {
    if (!cachedTravelUpdatedAt.value) return '';
    const date = new Date(cachedTravelUpdatedAt.value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('de-DE');
});
const allTravelsSelected = computed(() => travels.value.length > 0 && selectedTravels.value.length === travels.value.length);
const someTravelsSelected = computed(() => selectedTravels.value.length > 0 && !allTravelsSelected.value);
const livePollingSecondsLabel = computed(() => `${Math.round(livePollingIntervalMs.value / 1000)}s`);
const mapProviderOptions = computed(() =>
    mapAdapters.map(adapter => ({ title: adapter.label, value: adapter.id }))
);

function travelKey(item) {
    const source = item?.source || 'auto';
    const id = item?.id || `${item?.deviceId || ''}:${item?.von}:${item?.bis}`;
    return `${source}:${id}`;
}

function isTravelSelected(item) {
    const key = travelKey(item);
    return selectedTravels.value.some(selected => travelKey(selected) === key);
}

function openSettingsDialog() {
    settingsdialog.value = true;
}

function setStartDate(params) {
    startdate.value = params;
}
function setStopDate(params) {
    stopdate.value = params;
}

async function update_travel(item) {
    const values = Array.isArray(item) ? item : [item];
    const selectedItems = values
        .map(entry => typeof entry === 'string' ? travels.value.find(t => t.title === entry) : entry)
        .filter(Boolean);
    await setSelectedTravels(selectedItems);
}

async function toggleAllTravels() {
    if (travels.value.length === 0) return;
    if (allTravelsSelected.value) {
        const fallback = selectedTravels.value[0] || travels.value[travels.value.length - 1];
        await setSelectedTravels([fallback]);
        return;
    }
    await setSelectedTravels([...travels.value]);
}

async function handleLiveModeToggle(value) {
    await setLiveModeEnabled(Boolean(value));
}

function handleLiveIntervalChange(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    setLivePollingInterval(next);
}

function handleMapProviderChange(value) {
    if (value === 'google' || value === 'osm') {
        setMapProvider(value);
    }
}

const menuitems = computed(() => {
    const items = []
    items.push({
        key: 'Refresh from server',
        label: 'Refresh from server',
        disabled: isOffline.value
    })
    if (isAdmin.value) {
        items.push(
            { key: 'POI Mode', label: 'POI Mode' },
            { key: 'Manual Travel', label: 'Manual Travel' },
            { key: 'Settings', label: 'Settings' }
        )
    }
    items.push({ key: 'About', label: 'About' }, { key: 'Export als KML', label: 'Export als KML' })
    if (isAdmin.value) {
        items.push({ key: 'Debug', label: 'Debug' }, { key: 'Prefetch again', label: 'Prefetch again' })
    }
    if (authState.value.authenticated) {
        const name = String(authState.value.user || '').trim()
        items.push({ key: 'Log Out', label: name ? `Log Out (${name})` : 'Log Out' })
    }
    return items
})
async function domenu(item) {
    switch (item) {
        case 'Refresh from server':
            if (!isOffline.value) {
                await renderMap()
            }
            break;
        case 'POI Mode':
            poiMode.value = !poiMode.value
            console.log('POI Mode toggled:', poiMode.value)
            break;
        case 'Settings':
            configdialog.value = true
            break;
        case 'Manual Travel':
            manualtraveldialog.value = true
            break;
        case 'About':
            aboutdialog.value = true
            break;
        case 'Debug':
            openSettingsDialog()
            break;
        case 'Export als KML':
            downloadKml()
            break;
        case 'Prefetch again':
            await handlePrefetchAgain()
            break;
        case 'Log Out':
            await logout()
            break;
        case 'Export als GPX':
            //downloadgpx()
            break;
        case 'Export als CSV':
            //downloadcsv()
            break;
        case 'Export als PDF':
            //downloadpdf()
            break;
    }
}

async function logout() {
    try {
        await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
        console.error('Error during logout:', error)
    } finally {
        const logoutUrl = config.public.autheliaLogoutUrl
        if (logoutUrl && typeof window !== 'undefined') {
            window.location.assign(logoutUrl)
        } else if (typeof window !== 'undefined') {
            window.location.reload()
        }
    }
}

// Handle prefetch again
async function handlePrefetchAgain() {
    prefetching.value = true
    try {
        await rebuildCache()
        await getTravels()
    } catch (error) {
        console.error('Error rebuilding cache:', error)
    } finally {
        prefetching.value = false
    }
}

// Load travels on component mount
onMounted(async () => {
    try {
        // Check if cache exists
        const cacheStatus = await checkCacheStatus()

        if (!cacheStatus.hasCache) {
            // No cache - prefetch first
            console.log('No cache found, prefetching route data...')
            prefetching.value = true
            await prefetchRoute()
            prefetching.value = false
        }

        // Load travels
        await getTravels()
    } catch (error) {
        console.error('Error during initialization:', error)
        prefetching.value = false
    }
})
</script>

<template>
    <!-- Prefetch Loading Overlay -->
    <v-overlay
        v-model="prefetching"
        class="align-center justify-center"
        persistent
        :scrim="true"
    >
        <v-card
            class="pa-8 text-center"
            min-width="400"
        >
            <v-card-text>
                <v-progress-circular
                    indeterminate
                    color="primary"
                    size="64"
                    width="6"
                    class="mb-4"
                ></v-progress-circular>
                <div class="text-h6 mb-2">Rebuilding Route Cache</div>
                <div class="text-body-2 text-grey">
                    Fetching route data from Traccar API...
                </div>
                <div class="text-caption text-grey mt-2">
                    This may take a few moments
                </div>
            </v-card-text>
        </v-card>
    </v-overlay>

    <v-app-bar
        name="menu-bar"
        app
        density="compact"
        color="grey-darken-3"
        :elevation="5"
        >
        <template v-slot:prepend>
            <v-menu location="bottom" :close-on-content-click="false">
                <template v-slot:activator="{ props: menu }">
                    <v-app-bar-nav-icon
                        v-bind="menu"
                        nosize="small"
                    >
                    </v-app-bar-nav-icon>
                </template>
                <v-list density="compact">
                <v-list-item class="map-provider-menu-item">
                    <v-select
                        density="comfortable"
                        hide-details
                        variant="outlined"
                        prepend-inner-icon="mdi-map"
                        label="Kartenanbieter"
                        :items="mapProviderOptions"
                        item-title="title"
                        item-value="value"
                        :model-value="mapProvider"
                        class="map-provider-menu-select"
                        @update:model-value="handleMapProviderChange"
                    ></v-select>
                </v-list-item>
                <v-divider></v-divider>
                <v-list-item v-if="smAndDown">
                    <v-select
                        :label="''"
                        placeholder="Reise auswählen"
                        density="compact"
                        hide-details
                        single-line
                        v-model="selectedTravels"
                        :items="travels"
                        multiple
                        item-title="title"
                        return-object
                        :menu-props="{ contentClass: 'travel-select-menu mobile-travel-select-menu' }"
                        @update:model-value="update_travel"
                        class="mobile-travel-select"
                    >
                        <template v-slot:prepend-item>
                            <v-list-item @click="toggleAllTravels">
                                <template v-slot:prepend>
                                    <v-checkbox-btn
                                        :model-value="allTravelsSelected"
                                        :indeterminate="someTravelsSelected"
                                        color="primary"
                                        readonly
                                    ></v-checkbox-btn>
                                </template>
                                <v-list-item-title>Alle Reisen</v-list-item-title>
                            </v-list-item>
                            <v-divider></v-divider>
                        </template>
                        <template v-slot:selection="{ item, index }">
                            <span v-if="index === 0">{{ item.raw?.title || item.title }}</span>
                            <span v-if="index === 1" class="text-caption ml-1">+{{ selectedTravels.length - 1 }}</span>
                        </template>
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props" :title="null" :subtitle="null">
                                <template v-slot:prepend>
                                    <v-icon
                                        :icon="isTravelSelected(item.raw || item) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                                        size="small"
                                        class="mr-2"
                                    ></v-icon>
                                </template>
                                <v-list-item-title class="d-flex align-center">
                                    <span>{{ item.raw?.title || item.title }}</span>
                                </v-list-item-title>
                            </v-list-item>
                        </template>
                    </v-select>
                </v-list-item>
                <v-list-item
                        v-for="(item, index) in menuitems"
                        :key="index"
                        :value="item.key"
                        :disabled="item.disabled"
                    >
                        <v-list-item-title @click="domenu(item.key)">
                            <template v-if="item.key === 'POI Mode'">
                                <v-icon :icon="poiMode ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'" size="small" class="mr-2"></v-icon>
                                POI Mode
                            </template>
                            <template v-else>
                                {{ item.label }}
                            </template>
                        </v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
            <!--v-app-bar-title class="ml-2">Traccar Viewer</v-app-bar-title-->
        </template>

        <template v-slot:default>
            <v-select
                v-if="!smAndDown"
                :label="`${selectedTravels.length} / ${travels.length} Reisen`"
                flat
                density="compact"
                prepend-icon="mdi-dots-vertical"
                v-model="selectedTravels"
                :items="travels"
                multiple
                item-title="title"
                return-object
                :menu-props="{ contentClass: 'travel-select-menu' }"
                @update:model-value="update_travel"
                class="mt-5 ml-0 mb-0 pb-0"
            >
                <template v-slot:prepend-item>
                    <v-list-item @click="toggleAllTravels">
                        <template v-slot:prepend>
                            <v-checkbox-btn
                                :model-value="allTravelsSelected"
                                :indeterminate="someTravelsSelected"
                                color="primary"
                                readonly
                            ></v-checkbox-btn>
                        </template>
                        <v-list-item-title>Alle Reisen</v-list-item-title>
                    </v-list-item>
                    <v-divider></v-divider>
                </template>
                <template v-slot:selection="{ item, index }">
                    <span v-if="index === 0">{{ item.raw?.title || item.title }}</span>
                    <span v-if="index === 1" class="text-caption ml-1">+{{ selectedTravels.length - 1 }}</span>
                </template>
                <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :title="null" :subtitle="null">
                        <template v-slot:prepend>
                            <v-icon
                                :icon="isTravelSelected(item.raw || item) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                                size="small"
                                class="mr-2"
                            ></v-icon>
                        </template>
                        <v-list-item-title class="d-flex align-center">
                            <span>{{ item.raw?.title || item.title }}</span>
                        </v-list-item-title>
                    </v-list-item>
                </template>
            </v-select>
            <v-chip
                variant="flat"
                color="transparent"
                class="appbar-distance">
                {{ selectedTravels.length > 1 ? `Gesamt: ${Math.round(distance)} km` : `${Math.round(distance)} km` }}
            </v-chip>
            <div class="appbar-dates">
                <div class="appbar-date">
                    <DateDialog :key="`start-${startdate}`" :datum="startdate" @getDate="setStartDate"/>
                </div>
                <div class="appbar-date">
                    <DateDialog :key="`stop-${stopdate}`" :datum="stopdate" @getDate="setStopDate"/>
                </div>
            </div>
        </template>
        <template v-slot:append>
            <v-chip
                v-if="isOffline"
                size="x-small"
                color="warning"
                class="mr-1"
            >
                Offline
            </v-chip>
            <v-chip
                v-if="usingCachedTravel"
                size="x-small"
                color="info"
                class="mr-1"
            >
                Cache {{ cachedTravelUpdatedLabel }}
            </v-chip>
            <v-menu location="bottom end" :close-on-content-click="false">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        :icon="liveMode ? 'mdi-access-point-check' : 'mdi-access-point'"
                        class="ml-1"
                        nosize="small"
                        :color="liveMode ? 'success' : undefined"
                    ></v-btn>
                </template>
                <v-card min-width="240" class="pa-3">
                    <v-switch
                        :model-value="liveMode"
                        :loading="livePollingInFlight"
                        color="success"
                        inset
                        hide-details
                        density="compact"
                        label="Live Mode"
                        @update:model-value="handleLiveModeToggle"
                    ></v-switch>
                    <v-select
                        class="mt-2"
                        density="compact"
                        hide-details
                        label="Polling Interval"
                        :items="liveIntervalOptions"
                        item-title="title"
                        item-value="value"
                        :model-value="livePollingIntervalMs"
                        @update:model-value="handleLiveIntervalChange"
                    ></v-select>
                    <div class="text-caption mt-2 text-grey">
                        Status: {{ liveMode ? `Aktiv (${livePollingSecondsLabel})` : 'Aus' }}
                    </div>
                </v-card>
            </v-menu>
            <v-btn
                icon="mdi-reload"
                class="ml-1 appbar-reload"
                nosize="small"
                @click="renderMap"
            ></v-btn>
            <!--v-btn
                icon="mdi-set-all"
                class="ml-0"
                nosize="small"
                @click="renderMap"
            ></v-btn -->
            <v-btn v-if="!smAndDown" icon= "mdi-rv-truck" href="https://tagebuch.smallfamilybusiness.net/" target="_blank" size="small"></v-btn>
            <!-- v-menu
                location="bottom"
                >
                <template v-slot:activator="{ props }">
                    <v-btn
                        icon="mdi-palette-swatch"
                        @click="toggleTheme"
                        v-bind="props"
                        size="small"
                    ></v-btn>
                </template>
                <v-list
                    density="compact"
                >
                        <v-list-item
                            v-for="[key, value] of Object.entries(theme.themes.value).filter(filterTheme)"
                            v-bind="props"
                            :key="key"
                            :value="key"
                            :color="isHovering ? 'primary' : 'transparent'"
                            >
                            <v-list-item-title
                                @click="setTheme(key)"
                            >{{ key }}</v-list-item-title>
                        </v-list-item>
                </v-list>
            </v-menu-->
        </template>
    </v-app-bar>
</template>

<style scoped>
/* iPhone-specific optimizations for compact app bar controls */
@media (max-width: 425px) {
  :deep(.v-toolbar__content) {
    padding-inline: 2px;
  }

  .appbar-distance {
    margin-inline: 2px !important;
    padding-inline: 2px !important;
    min-width: 78px;
    white-space: nowrap;
    font-size: 12px;
  }

  .appbar-dates {
    gap: 1px;
    margin-left: 0;
  }

  .appbar-date :deep(.v-btn) {
    min-width: 0 !important;
    padding-inline: 4px !important;
    font-size: 12px !important;
  }

  .appbar-date :deep(.v-btn__prepend) {
    display: none !important;
  }

  .appbar-reload {
    margin-left: 1px !important;
  }
}

.mobile-travel-select {
  min-width: 220px;
}

.map-provider-menu-item {
  overflow: visible;
  min-height: 74px !important;
  align-items: flex-start !important;
  padding-top: 6px;
  padding-bottom: 8px;
}

.map-provider-menu-select {
  margin-top: 3px;
}

.map-provider-menu-item :deep(.v-list-item__content) {
  overflow: visible !important;
  width: 100%;
}

.map-provider-menu-item :deep(.v-input),
.map-provider-menu-item :deep(.v-field),
.map-provider-menu-item :deep(.v-field__overlay),
.map-provider-menu-item :deep(.v-field__field) {
  overflow: visible !important;
}

:deep(.travel-select-menu .v-list-item__content) {
  padding-inline-start: 0;
}

.appbar-distance {
  margin-left: 2px;
  margin-right: auto;
  min-width: 78px;
  justify-content: flex-start;
}

.appbar-dates {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}
</style>
