<script setup lang="ts">
import { computed } from 'vue'
import { useMapProvider } from '~/composables/useMapProvider'

const { activeMapAdapter } = useMapProvider()
const activeComponent = computed(() => activeMapAdapter.value.component)
const activeAdapterKey = computed(() => activeMapAdapter.value.id)
</script>

<template>
  <component :is="activeComponent" :key="activeAdapterKey" />
</template>
