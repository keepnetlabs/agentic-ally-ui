<script setup lang="ts">
import type { ComparisonSection } from '../../types/report'

defineProps<{ section: ComparisonSection }>()
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-3">
      {{ section.title }}
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Left -->
      <div class="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4">
        <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">
          {{ section.left.label }}
        </h3>
        <div
          v-for="(point, i) in section.left.points"
          :key="i"
          class="mb-2"
        >
          <ReportMarkdown :content="point" />
        </div>
      </div>

      <!-- Right -->
      <div class="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-4">
        <h3 class="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3">
          {{ section.right.label }}
        </h3>
        <div
          v-for="(point, i) in section.right.points"
          :key="i"
          class="mb-2"
        >
          <ReportMarkdown :content="point" />
        </div>
      </div>
    </div>
  </div>
</template>
