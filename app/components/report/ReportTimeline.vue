<script setup lang="ts">
import type { TimelineSection } from '../../types/report'

defineProps<{ section: TimelineSection }>()

function statusColor(status?: string) {
  if (status === 'completed') return 'bg-emerald-500'
  if (status === 'in_progress') return 'bg-amber-500'
  return 'bg-gray-300 dark:bg-gray-600'
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-4">{{ section.title }}</h2>
    <div class="relative pl-6 space-y-4">
      <!-- Vertical line -->
      <div class="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

      <div
        v-for="(item, i) in section.items"
        :key="i"
        class="relative"
      >
        <!-- Dot -->
        <div
          class="absolute -left-4 top-1.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900"
          :class="statusColor(item.status)"
        />

        <div class="ml-2">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ item.date }}</span>
            <UBadge v-if="item.status" :color="item.status === 'completed' ? 'success' : item.status === 'in_progress' ? 'warning' : 'neutral'" variant="soft" size="xs">
              {{ item.status?.replace('_', ' ') }}
            </UBadge>
          </div>
          <p class="text-sm font-medium">{{ item.event }}</p>
          <p v-if="item.detail" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ item.detail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
