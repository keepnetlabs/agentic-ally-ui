<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  sectionId: string
  sectionType: string
  title: string
}>()

const emit = defineEmits<{
  regenerate: [sectionId: string]
}>()

const showActions = ref(false)
const isRegenerating = ref(false)

function handleRegenerate() {
  isRegenerating.value = true
  emit('regenerate', props.sectionId)
}

// Called from parent when regeneration completes
defineExpose({
  finishRegenerate: () => { isRegenerating.value = false }
})
</script>

<template>
  <div
    class="group relative"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
  >
    <!-- Regenerate button — hidden until API integration is complete -->
    <div
      v-show="false"
      class="absolute top-3 right-3 z-10 flex items-center gap-1"
    >
      <UTooltip text="Regenerate this section">
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-refresh-cw"
          @click.stop="handleRegenerate"
        />
      </UTooltip>
    </div>

    <!-- Regenerating overlay — hidden until API integration is complete -->
    <div
      v-if="false"
      class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-xl backdrop-blur-sm"
    >
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <UIcon name="i-lucide-loader-2" class="h-4 w-4 animate-spin" />
        Regenerating...
      </div>
    </div>

    <!-- Section content -->
    <slot />
  </div>
</template>
