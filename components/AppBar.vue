<script setup>
import { ref, onMounted, mergeProps, computed } from 'vue';
import { useTraccar } from '~/composables/useTraccar';
import { useMapData } from '~/composables/useMapData';
import { setCookie } from '~/utils/crypto';
import { useAuth } from '~/composables/useAuth';

const { startdate, stopdate, travel, travels, getTravels, downloadKml, rebuildCache, checkCacheStatus, prefetchRoute } = useTraccar();
const { distance, renderMap, settingsdialog, configdialog, aboutdialog, poiMode } = useMapData();
const config = useRuntimeConfig();
const { isAdmin, authState } = useAuth();

const prefetching = ref(false);

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
    var index = travels.value.map(function(e) { return e.title; }).indexOf(item);
    console.log('🗺️  Travel selected:', item, 'index:', index);
    console.log('   Travel data:', travels.value[index]);
    travel.value = travels.value[index]
    setCookie('travelindex', String(index), 30)
    startdate.value = new Date(travels.value[index].von);
    stopdate.value = new Date(travels.value[index].bis);
    console.log('   Set startdate to:', startdate.value);
    console.log('   Set stopdate to:', stopdate.value);
    console.log('   Calling renderMap()...');
    renderMap()
}

const menuitems = computed(() => {
    const items = []
    if (isAdmin.value) {
        items.push({ key: 'POI Mode', label: 'POI Mode' }, { key: 'Settings', label: 'Settings' })
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
        case 'POI Mode':
            poiMode.value = !poiMode.value
            console.log('POI Mode toggled:', poiMode.value)
            break;
        case 'Settings':
            configdialog.value = true
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
        density="compact"
        color="grey-darken-3"
        :elevation="5"
        >
        <template v-slot:prepend>
            <v-menu location="bottom">
                <template v-slot:activator="{ props: menu }">
                    <v-tooltip open-delay="500">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-app-bar-nav-icon
                            v-bind="mergeProps(menu, tooltip)"
                            nosize="small"
                            >
                            </v-app-bar-nav-icon>
                        </template>
                        <span>Tooltip</span>
                    </v-tooltip>
                </template>
                <v-list density="compact">
                <v-list-item
                        v-for="(item, index) in menuitems"
                        :key="index"
                        :value="item.key"
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
                :label="`${travels.length} Reisen`"
                flat
                density="compact"
                prepend-icon="mdi-dots-vertical"
                v-model="travel"
                :items="travels"
                @update:model-value="update_travel"
                class="mt-5 ml-6 mb-0 pb-0"
            ></v-select>
            <v-chip
                variant="flat"
                color="transparent"
                class="ml-2">
                {{ Math.round(distance) }} km
            </v-chip>
            <DateDialog :key="`start-${startdate}`" :datum="startdate" @getDate="setStartDate"/>
            <DateDialog :key="`stop-${stopdate}`" :datum="stopdate" @getDate="setStopDate"/>
        </template>
        <template v-slot:append>
            <v-btn
                icon="mdi-reload"
                class="ml-2"
                nosize="small"
                @click="renderMap"
            ></v-btn>
            <!--v-btn
                icon="mdi-set-all"
                class="ml-0"
                nosize="small"
                @click="renderMap"
            ></v-btn -->
            <v-btn icon= "mdi-rv-truck" href="https://tagebuch.smallfamilybusiness.net/" size="small"></v-btn>
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
/* iPhone-specific optimizations for travel dropdown */
@media (max-width: 425px) {
  /* Increase touch target size for select dropdown */
  :deep(.v-select) {
    min-height: 48px !important;
  }

  :deep(.v-select .v-field__input) {
    min-height: 48px !important;
    font-size: 16px !important;
    padding-top: 12px !important;
    padding-bottom: 12px !important;
  }

  :deep(.v-select .v-field__append-inner) {
    padding-top: 12px !important;
  }

  :deep(.v-select .v-field__prepend-inner) {
    padding-top: 12px !important;
  }

  /* Increase font size for better readability */
  :deep(.v-select .v-select__selection) {
    font-size: 16px !important;
  }

  :deep(.v-label) {
    font-size: 14px !important;
  }

  /* Increase chip text size */
  :deep(.v-chip) {
    font-size: 15px !important;
  }
}

/* Make travel dropdown menu items more touch-friendly on iPhone */
@media (max-width: 425px) {
  :deep(.v-list-item) {
    min-height: 48px !important;
  }

  :deep(.v-list-item-title) {
    font-size: 16px !important;
  }
}
</style>
