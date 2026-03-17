<script setup lang="ts">
import type { RecommendationsSection } from '../../types/report'

defineProps<{ section: RecommendationsSection }>()

function priorityColor(priority: string) {
  const colors: Record<string, string> = {
    critical: 'text-white bg-[#E94F2E]',
    high: 'text-white bg-[#0B326F]',
    medium: 'text-[#41526B] bg-[#ECEFF3]',
    low: 'text-[#41526B] bg-[#FAFBFC] border border-[#ECEFF3]',
  }
  return colors[priority] || colors.medium
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-4">{{ section.title }}</h2>
    <div class="space-y-3">
      <div
        v-for="(item, i) in section.items"
        :key="i"
        class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
      >
        <span
          class="shrink-0 px-2 py-0.5 rounded text-xs font-semibold uppercase"
          :class="priorityColor(item.priority)"
        >
          {{ item.priority }}
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium">{{ item.text }}</p>
          <p v-if="item.detail" class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ item.detail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
