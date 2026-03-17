<script setup lang="ts">
import type { ExecutiveSummarySection } from '../../types/report'

defineProps<{ section: ExecutiveSummarySection }>()
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-3">{{ section.title }}</h2>

    <ReportMarkdown :content="section.content" />

    <!-- Key Findings -->
    <div v-if="section.keyFindings?.length" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Key Findings</h3>
      <ul class="space-y-1.5">
        <li
          v-for="(finding, i) in section.keyFindings"
          :key="i"
          class="flex items-start gap-2 text-xs"
        >
          <span class="text-[#E94F2E] shrink-0 mt-0.5 text-xs">■</span>
          <span>{{ finding }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
