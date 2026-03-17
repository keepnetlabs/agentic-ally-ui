<script setup lang="ts">
// @ts-ignore - Nuxt auto-imports
import { useToast } from '#imports'
import { ref, onMounted } from 'vue'
import type { Report } from '../types/report'

const toast = useToast()
const report = ref<Report | null>(null)
const reportId = ref('rpt_test123')
const version = ref(1)
const showViewer = ref(false)
const showPrintView = ref(false)
const viewerRef = ref<{ updateSection: (id: string, section: any) => void } | null>(null)
const loading = ref(true)
const error = ref('')

function handleRegenerate(sectionId: string, _reportId: string) {
  // TODO: Call agent API to regenerate section
  // For now: show toast notification
  toast.add({ title: `Regenerate requested: ${sectionId}`, description: 'API integration coming soon', color: 'blue' })

  // Simulate completion after 2s
  setTimeout(() => {
    toast.add({ title: `Section "${sectionId}" would be regenerated here`, color: 'success' })
  }, 2000)
}

onMounted(async () => {
  try {
    const res = await fetch('/report-test-data.json')
    const data = await res.json()
    report.value = data.report
    reportId.value = data.reportId || 'rpt_test'
    version.value = data.version || 1
    loading.value = false
  } catch (e) {
    error.value = (e as Error).message
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-950 p-8">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">Report Viewer Test</h1>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12 text-gray-500">
        Loading report data...
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600">
        {{ error }}
      </div>

      <!-- Report Card Preview -->
      <template v-else-if="report">
        <ReportCard
          :report="{
            reportId,
            version,
            title: report.meta.title,
            subtitle: report.meta.subtitle,
            pageTarget: report.meta.pageTarget,
            sectionCount: report.sections.length,
            report,
          }"
          @view="showViewer = true"
          @print="showPrintView = true"
        />

        <p class="text-sm text-gray-500 mt-4">
          Click "View Report" to open the full report viewer modal.
        </p>

        <!-- Section type summary -->
        <div class="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <h3 class="text-sm font-semibold mb-3">Sections ({{ report.sections.length }})</h3>
          <div class="space-y-1">
            <div
              v-for="section in report.sections"
              :key="section.id"
              class="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span class="font-mono text-gray-500">{{ section.type }}</span>
              <span class="text-gray-400">{{ section.id }}</span>
              <span class="text-gray-400">w={{ section.weight }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Report Viewer Modal -->
    <ReportViewer
      v-if="showViewer && report"
      ref="viewerRef"
      :report="report"
      :report-id="reportId"
      :version="version"
      @close="showViewer = false"
      @regenerate="handleRegenerate"
      @print="showViewer = false; showPrintView = true"
    />

    <!-- Print View (PDF export) -->
    <ReportPrintView
      v-if="showPrintView && report"
      :report="report"
      :report-id="reportId"
      @close="showPrintView = false"
    />
  </div>
</template>
