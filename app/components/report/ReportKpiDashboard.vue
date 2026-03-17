<script setup lang="ts">
import type { KpiDashboardSection } from '../../types/report'

defineProps<{ section: KpiDashboardSection }>()

function trendArrow(trend: string) {
  if (trend === 'up') return '▲'
  if (trend === 'down') return '▼'
  return '●'
}

function trendColor(trend: string) {
  if (trend === 'up') return 'text-emerald-500'
  if (trend === 'down') return 'text-red-500'
  return 'text-gray-400'
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-4">{{ section.title }}</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div
        v-for="kpi in section.kpis"
        :key="kpi.label"
        class="rounded-lg bg-gray-50 dark:bg-gray-800 p-4"
      >
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ kpi.label }}</div>
        <div class="text-2xl font-bold">{{ kpi.value }}</div>
        <div class="flex items-center gap-1 mt-1">
          <span class="text-xs" :class="trendColor(kpi.trend)">{{ trendArrow(kpi.trend) }}</span>
          <span v-if="kpi.delta" class="text-xs" :class="trendColor(kpi.trend)">{{ kpi.delta }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
