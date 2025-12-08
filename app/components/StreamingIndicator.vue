<script setup lang="ts">
const props = defineProps<{
  isStreaming: boolean
}>()
</script>

<template>
  <div v-if="isStreaming" class="flex items-start gap-2 text-xs text-muted-foreground">
    <UIcon name="i-lucide-loader-2" class="w-3.5 h-3.5 mt-0.5 animate-spin" />
    <span>Thinking...</span>
  </div>
</template>

