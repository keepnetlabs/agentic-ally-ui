<script setup lang="ts">
import { computed } from 'vue'
import type { ReportCardPayload } from '../utils/message-utils'

const props = defineProps<{
  report: ReportCardPayload
}>()

const emit = defineEmits<{
  view: [report: ReportCardPayload]
  print: [report: ReportCardPayload]
}>()

const formattedDate = computed(() => {
  try {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-gray-700 dark:bg-gray-950">
    <div class="px-4 py-3 md:px-5 md:py-4">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
          <UIcon name="i-lucide-file-text" class="h-4 w-4 shrink-0" />
          <span class="text-sm font-medium truncate">{{ report.title }}</span>
        </div>
        <UBadge color="primary" variant="soft" size="xs">
          {{ report.pageTarget }} pages
        </UBadge>
      </div>

      <!-- Subtitle -->
      <p
        v-if="report.subtitle"
        class="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1"
      >
        {{ report.subtitle }}
      </p>

      <!-- Stats -->
      <div class="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-layers" class="h-3.5 w-3.5" />
          {{ report.sectionCount }} sections
        </span>
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="h-3.5 w-3.5" />
          {{ formattedDate }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-hash" class="h-3.5 w-3.5" />
          v{{ report.version }}
        </span>
      </div>

      <!-- Actions -->
      <div class="mt-3 flex items-center gap-2">
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-eye"
          @click.stop="emit('view', report)"
        >
          View Report
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-download"
          @click.stop="emit('print', report)"
        >
          Export PDF
        </UButton>
      </div>
    </div>
  </div>
</template>
