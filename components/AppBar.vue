<script setup>
import { ref, onMounted, computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useTraccar } from '~/composables/useTraccar';
import { useMapData } from '~/composables/useMapData';
import { setCookie } from '~/utils/crypto';
import { useAuth } from '~/composables/useAuth';
import { useTravelCache } from '~/composables/useTravelCache';

const { startdate, stopdate, travel, travels, getTravels, downloadKml, rebuildCache, checkCacheStatus, prefetchRoute, device } = useTraccar();
const { distance, renderMap, settingsdialog, configdialog, aboutdialog, poiMode, manualtraveldialog } = useMapData();
const config = useRuntimeConfig();
const { isAdmin, authState } = useAuth();
const { isOffline, usingCachedTravel, cachedTravelUpdatedAt } = useTravelCache();
const { smAndDown } = useDisplay();

const prefetching = ref(false);
const cachedTravelUpdatedLabel = computed(() => {
    if (!cachedTravelUpdatedAt.value) return '';
    const date = new Date(cachedTravelUpdatedAt.value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('de-DE');
});

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
    const selected = typeof item === 'string'
        ? travels.value.find(t => t.title === item)
        : item;
    const index = travels.value.findIndex(t => t === selected || t.title === selected?.title);
    console.log('🗺️  Travel selected:', selected, 'index:', index);
    if (!selected) return;

    console.log('   Travel data:', selected);
    travel.value = selected;
    setCookie('travelindex', String(index), 30);

    if (selected.deviceId) {
        device.value = {
            ...device.value,
            id: selected.deviceId
        };
    }

    startdate.value = new Date(selected.von);
    stopdate.value = new Date(selected.bis);
    console.log('   Set startdate to:', startdate.value);
    console.log('   Set stopdate to:', stopdate.value);
    console.log('   Calling renderMap()...');
    renderMap();
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
            <v-menu location="bottom" :close-on-content-click="!smAndDown">
                <template v-slot:activator="{ props: menu }">
                    <v-app-bar-nav-icon
                        v-bind="menu"
                        nosize="small"
                    >
                    </v-app-bar-nav-icon>
                </template>
                <v-list density="compact">
                <v-list-item v-if="smAndDown">
                    <v-select
                        :label="''"
                        placeholder="Reise auswählen"
                        density="compact"
                        hide-details
                        single-line
                        v-model="travel"
                        :items="travels"
                        item-title="title"
                        return-object
                        :menu-props="{ contentClass: 'travel-select-menu mobile-travel-select-menu' }"
                        @update:model-value="update_travel"
                        class="mobile-travel-select"
                    >
                        <template v-slot:selection="{ item }">
                            <div class="d-flex align-center">
                                <span>{{ item.raw?.title || item.title }}</span>
                            </div>
                        </template>
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props" :title="null" :subtitle="null">
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
                :label="`${travels.length} Reisen`"
                flat
                density="compact"
                prepend-icon="mdi-dots-vertical"
                v-model="travel"
                :items="travels"
                item-title="title"
                return-object
                :menu-props="{ contentClass: 'travel-select-menu' }"
                @update:model-value="update_travel"
                class="mt-5 ml-0 mb-0 pb-0"
            >
                <template v-slot:selection="{ item }">
                    <div class="d-flex align-center">
                        <!--span class="travel-icon-slot">
                            <v-icon
                                v-if="item.raw?.source === 'manual'"
                                icon="mdi-hand"
                                size="x-small"
                            ></v-icon>
                        </span-->
                        <span>{{ item.raw?.title || item.title }}</span>
                    </div>
                </template>
                <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :title="null" :subtitle="null">
                        <v-list-item-title class="d-flex align-center">
                            <!--span class="travel-icon-slot">
                                <v-icon
                                    v-if="item.raw?.source === 'manual'"
                                    icon="mdi-hand"
                                    size="x-small"
                                ></v-icon>
                            </span-->
                            <span>{{ item.raw?.title || item.title }}</span>
                        </v-list-item-title>
                    </v-list-item>
                </template>
            </v-select>
            <v-chip
                variant="flat"
                color="transparent"
                class="appbar-distance">
                {{ Math.round(distance) }} km
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
