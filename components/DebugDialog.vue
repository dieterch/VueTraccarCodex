<script setup>
import { ref } from 'vue'
import { useTraccar } from '~/composables/useTraccar'
import { useMapData } from '~/composables/useMapData'

const { getRoute, getEvents } = useTraccar()
const {
  togglemap,
  togglemarkers,
  togglepath,
  toggletravels,
  toggleroute,
  toggleEvents,
  settingsdialog
} = useMapData()
</script>

<template>
      <v-dialog
        v-model="settingsdialog"
        width="auto"
      >
        <v-card 
            title="Debug" 
            class="bg-surface"
            style="opacity: 0.7;"
        >
            <v-card-text
            color="white"
            >
                <v-container 
                    color="white"
                    fluid>
                    <v-row>
                        <v-col cols="auto">
                            <v-switch
                                v-model="togglemap"
                                hide-details
                                color="green"
                                density="compact"
                                label="Karte"
                            ></v-switch>
                        </v-col>
                        <v-col cols="auto">
                            <v-switch
                                v-model="togglemarkers"
                                hide-details
                                color="red"
                                density="compact"
                                label="Marker"
                            ></v-switch>
                        </v-col>
                        <v-col cols="auto">
                            <v-switch
                                v-model="togglepath"
                                hide-details
                                color="orange"
                                density="compact"
                                label="Pfad"
                            ></v-switch>
                        </v-col>
                        <v-col cols="auto">
                            <v-switch
                                v-model="toggletravels"
                                hide-details
                                color="grey"
                                density="compact"
                                label="Reise"
                            ></v-switch>
                        </v-col>
                        <v-col cols="auto">
                            <v-switch
                                v-model="toggleEvents"
                                hide-details
                                color="light-red"
                                density="compact"
                                label="Events"
                                @click="getEvents()"
                            ></v-switch>
                        </v-col>
                        <v-col cols="auto">
                            <v-switch
                                v-model="toggleroute"
                                hide-details
                                color="light-blue"
                                density="compact"
                                label="Route"
                                @click="getRoute()"
                            ></v-switch>
                        </v-col>
                    </v-row>
                </v-container>
          </v-card-text>
          <v-card-actions>
            <v-btn block @click="settingsdialog = false">Ok</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
  </template>