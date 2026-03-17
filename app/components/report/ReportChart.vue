<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler } from 'chart.js'
import type { ChartSection } from '../../types/report'

// Register all Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler)

// Lazy import vue-chartjs components
const Bar = defineAsyncComponent(() => import('vue-chartjs').then(m => m.Bar))
const Line = defineAsyncComponent(() => import('vue-chartjs').then(m => m.Line))
const Pie = defineAsyncComponent(() => import('vue-chartjs').then(m => m.Pie))
const Doughnut = defineAsyncComponent(() => import('vue-chartjs').then(m => m.Doughnut))
const Radar = defineAsyncComponent(() => import('vue-chartjs').then(m => m.Radar))
const PolarArea = defineAsyncComponent(() => import('vue-chartjs').then(m => m.PolarArea))
const Scatter = defineAsyncComponent(() => import('vue-chartjs').then(m => m.Scatter))

const props = defineProps<{ section: ChartSection }>()

const chartComponent = computed(() => {
  const map: Record<string, any> = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
    radar: Radar,
    polarArea: PolarArea,
    scatter: Scatter,
  }
  return map[props.section.chartConfig.type] || Bar
})

const chartData = computed(() => props.section.chartConfig.data)

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  ...props.section.chartConfig.options,
}))
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <h2 class="text-base font-bold text-[#0B326F] mb-2">{{ section.title }}</h2>
    <p v-if="section.description" class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      {{ section.description }}
    </p>
    <div class="h-64 md:h-80">
      <component
        :is="chartComponent"
        :data="chartData"
        :options="chartOptions"
      />
    </div>
  </div>
</template>
