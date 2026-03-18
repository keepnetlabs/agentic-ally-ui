<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { Report } from '../../types/report'
import { distributeToPages } from '../../utils/report-pagination'
import { exportReportToPdf } from '../../utils/report-pdf-export'

const props = defineProps<{
  report: Report
  reportId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const pages = distributeToPages(props.report.sections)
const totalPages = pages.length
const pagesContainer = ref<HTMLElement | null>(null)
const isExporting = ref(false)

async function handleExportPdf() {
  if (isExporting.value || !pagesContainer.value) return
  isExporting.value = true
  try {
    await nextTick()
    const filename = `${props.report.meta.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}-${props.reportId}.pdf`
    await exportReportToPdf(pagesContainer.value, filename)
  } catch (err) {
    console.error('PDF export failed:', err)
    // Fallback to window.print() if html2canvas fails
    window.print()
  } finally {
    isExporting.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-950 overflow-y-auto">
      <!-- Toolbar -->
      <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton variant="ghost" icon="i-lucide-arrow-left" size="sm" @click="emit('close')">
            Back
          </UButton>
          <span class="text-sm text-gray-500">{{ report.meta.title }} — {{ totalPages }} pages</span>
        </div>
        <UButton icon="i-lucide-download" size="sm" :loading="isExporting" @click="handleExportPdf">
          {{ isExporting ? 'Generating...' : 'Export PDF' }}
        </UButton>
      </div>

      <!-- A4 Pages -->
      <div ref="pagesContainer" class="py-8">
        <div
          v-for="page in pages"
          :key="page.number"
          class="a4-page mx-auto mb-8"
        >
          <!-- Keepnet Header Band -->
          <div class="page-header">
            <div class="flex items-center justify-between">
              <img
                :src="report.meta.branding?.logoUrl || 'https://imagedelivery.net/KxWh-mxPGDbsqJB3c5_fmA/f88de4cf-2fcd-4090-aca4-d5241c199b00/public'"
                alt="Logo"
                class="h-7"
              />
              <span class="text-xs text-white/60 font-medium">{{ report.meta.title }}</span>
            </div>
          </div>

          <!-- Content -->
          <div class="page-content">
            <template v-for="section in page.sections" :key="section.id">
              <ReportCover v-if="section.type === 'cover'" :section="section" :all-sections="report.sections" :branding="report.meta.branding" :language="report.meta.language" />
              <ReportExecSummary v-else-if="section.type === 'executive_summary'" :section="section" />
              <ReportKpiDashboard v-else-if="section.type === 'kpi_dashboard'" :section="section" />
              <ReportChart v-else-if="section.type === 'chart'" :section="section" />
              <ReportTable v-else-if="section.type === 'table'" :section="section" />
              <ReportContent v-else-if="section.type === 'content'" :section="section" />
              <ReportRecommendations v-else-if="section.type === 'recommendations'" :section="section" />
              <ReportTimeline v-else-if="section.type === 'timeline'" :section="section" />
              <ReportComparison v-else-if="section.type === 'comparison'" :section="section" />
            </template>
          </div>

          <!-- Keepnet Footer (navy like header) -->
          <div class="page-footer">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img
                  :src="report.meta.branding?.logoUrl || 'https://imagedelivery.net/KxWh-mxPGDbsqJB3c5_fmA/f88de4cf-2fcd-4090-aca4-d5241c199b00/public'"
                  alt="Logo"
                  class="h-3"
                />
                <span class="text-[8px] text-white/60">{{ report.meta.title }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-[8px] text-white/60">Page {{ page.number }} of {{ totalPages }}</span>
                <span class="text-[8px] text-white font-semibold">info@keepnetlabs.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.a4-page {
  width: 794px;
  min-height: 1123px;
  background: white;
  font-family: var(--font-sans, 'Public Sans', ui-sans-serif, system-ui, sans-serif);
  position: relative;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: #0B326F;
  padding: 16px 40px;
  flex-shrink: 0;
}

.page-content {
  flex: 1;
  padding: 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-footer {
  padding: 12px 40px;
  background: #0B326F;
  flex-shrink: 0;
}

/* Remove section card borders and padding in print view — maximize text space */
.a4-page .rounded-xl {
  border: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
  box-shadow: none !important;
}

/* Add subtle separator between sections instead */
.page-content > div + div {
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
  margin-top: 4px;
}

.dark .a4-page {
  background: white;
  color: #1f2937;
}
</style>
