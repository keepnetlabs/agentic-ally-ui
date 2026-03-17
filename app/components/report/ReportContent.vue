<script setup lang="ts">
import type { ContentSection } from '../../types/report'

defineProps<{ section: ContentSection }>()
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-3">{{ section.title }}</h2>
    <ReportMarkdown :content="section.content" />
  </div>
</template>
