<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  videoId: string
  status: string
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  errorMessage?: string | null
}>()

const isTerminal = computed(() =>
  props.status === 'completed' || props.status === 'failed'
)

const isCompleted = computed(() => props.status === 'completed')

const statusLabel = computed(() => {
  switch (props.status) {
    case 'pending':    return 'Queued'
    case 'processing': return 'Rendering...'
    case 'waiting':    return 'Waiting'
    case 'completed':  return 'Ready'
    case 'failed':     return 'Failed'
    default:           return 'Generating...'
  }
})
</script>

<template>
  <div class="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-gray-700 dark:bg-gray-950">
    <div class="px-4 py-3 md:px-5 md:py-4">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
          <UIcon name="i-lucide-video" class="h-4 w-4" />
          <span class="text-sm font-medium">Deepfake Video</span>
        </div>
        <UBadge
          :color="isCompleted ? 'success' : status === 'failed' ? 'error' : 'warning'"
          variant="soft"
          size="xs"
        >
          {{ statusLabel }}
        </UBadge>
      </div>

      <!-- Loading State -->
      <div
        v-if="!isTerminal"
        class="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <UIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin text-blue-500 shrink-0" />
        <div>
          <p class="text-sm font-medium text-slate-800 dark:text-slate-100">
            Video is being generated...
          </p>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
            This usually takes 5–10 minutes.
          </p>
        </div>
      </div>

      <!-- Video Player (completed) -->
      <div
        v-if="isCompleted && videoUrl"
        class="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black dark:border-gray-700"
      >
        <video
          :src="videoUrl"
          :poster="thumbnailUrl || undefined"
          controls
          class="w-full max-h-96"
          preload="metadata"
        />
      </div>

      <!-- Error State -->
      <div
        v-if="status === 'failed'"
        class="mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20"
      >
        <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-red-700 dark:text-red-300">
            Video generation failed. Please try again.
          </p>
          <p v-if="errorMessage" class="mt-1 text-xs text-red-600 dark:text-red-400 break-words">
            {{ errorMessage }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
