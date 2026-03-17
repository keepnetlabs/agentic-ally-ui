<script setup lang="ts">
import { computed } from 'vue'
import type { CoverSection, ReportSection } from '../../types/report'

const props = defineProps<{
  section: CoverSection
  allSections?: ReportSection[]
  branding?: { logoUrl?: string; companyName?: string; primaryColor?: string }
  language?: string
}>()

const tocSections = (props.allSections || []).filter(s => s.type !== 'cover')

const formattedDate = computed(() => {
  try {
    const date = new Date(props.section.date)
    if (isNaN(date.getTime())) return props.section.date
    const locale = props.language === 'tr' ? 'tr-TR' : props.language === 'de' ? 'de-DE' : 'en-US'
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return props.section.date
  }
})

function sectionIcon(type: string): string {
  const icons: Record<string, string> = {
    executive_summary: 'i-lucide-file-text',
    kpi_dashboard: 'i-lucide-gauge',
    chart: 'i-lucide-bar-chart-3',
    table: 'i-lucide-table',
    content: 'i-lucide-text',
    recommendations: 'i-lucide-lightbulb',
    timeline: 'i-lucide-clock',
    comparison: 'i-lucide-columns-2',
  }
  return icons[type] || 'i-lucide-file'
}
</script>

<template>
  <div class="rounded-xl overflow-hidden">
    <!-- Navy header band -->
    <div class="keepnet-cover-header">
      <div class="text-xl font-bold text-white tracking-wide mb-6">{{ branding?.companyName || 'Keepnet Labs' }}</div>
      <div class="w-12 h-1 bg-[#E94F2E] mx-auto mb-4 rounded-full" />
      <h1 class="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">{{ section.title }}</h1>
      <p v-if="section.subtitle" class="text-base text-white/80 mb-5">{{ section.subtitle }}</p>
      <div class="text-sm text-white/60">
        <span>{{ formattedDate }}</span>
      </div>
    </div>

    <!-- Table of Contents -->
    <div v-if="tocSections.length" class="bg-[#FAFBFC] px-8 py-6">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">Table of Contents</h3>
      <div class="space-y-1.5">
        <div
          v-for="(s, i) in tocSections"
          :key="s.id"
          class="flex items-center gap-3 py-1.5 text-sm"
        >
          <span class="text-[#9CA3AF] font-mono text-xs w-5 text-right">{{ i + 1 }}.</span>
          <span class="text-[#E94F2E] text-xs">●</span>
          <span class="text-[#41526B]">{{ s.title }}</span>
          <span class="flex-1 border-b border-dotted border-[#ECEFF3] mx-1" />
          <span class="text-xs text-[#9CA3AF]">{{ s.type.replace('_', ' ') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.keepnet-cover-header {
  background: linear-gradient(135deg, #0B326F 0%, #1E4A8A 100%);
  padding: 2.5rem 2rem;
  text-align: center;
}
</style>
