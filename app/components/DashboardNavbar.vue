<template>
  <UDashboardNavbar
    class="sticky lg:absolute top-0 inset-x-0 border-b-0 z-10 bg-default/75 backdrop-blur lg:bg-transparent lg:backdrop-blur-none pointer-events-none"
    :ui="{ left: 'pointer-events-auto', right: 'pointer-events-auto' }"
  >
    <template #right>
      <slot name="right" />

      <UColorModeButton v-if="!isCanvasVisible" />
    </template>
  </UDashboardNavbar>
</template>

<script setup lang="ts">
import { useCanvas } from '../composables/useCanvas'
const { isCanvasVisible } = useCanvas()
</script>
