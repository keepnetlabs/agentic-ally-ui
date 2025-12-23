<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LandingPage } from '../types/chat'

const props = defineProps<{
  landingPage: LandingPage
}>()

const emit = defineEmits<{
  close: []
}>()

const selectedPageIndex = ref(0)
const viewMode = ref<'mobile' | 'tablet' | 'desktop'>('desktop')

const hasMultiplePages = computed(() => props.landingPage.pages.length === 2)

const currentPage = computed(() => props.landingPage.pages[selectedPageIndex.value])

const setViewMode = (mode: 'mobile' | 'tablet' | 'desktop') => {
  viewMode.value = mode
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="border-b border-gray-200 dark:border-gray-700 px-3 py-2" style="background-color: var(--bg-ui);">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-layout" class="w-4 h-4" />
          <div>
            <h3 class="font-medium text-sm">{{ landingPage.name || 'Landing Page' }}</h3>
            <p class="text-xs text-muted-foreground mt-1">{{ landingPage.method }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- View Mode Buttons -->
          <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-smartphone"
              :color="viewMode === 'mobile' ? 'primary' : 'neutral'"
              @click="setViewMode('mobile')"
              class="transition-colors"
            />
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-tablet"
              :color="viewMode === 'tablet' ? 'primary' : 'neutral'"
              @click="setViewMode('tablet')"
              class="transition-colors"
            />
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-monitor"
              :color="viewMode === 'desktop' ? 'primary' : 'neutral'"
              @click="setViewMode('desktop')"
              class="transition-colors"
            />
          </div>
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            @click="emit('close')"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          />
        </div>
      </div>
    </div>

    <!-- Tabs for 2 pages -->
    <div v-if="hasMultiplePages" class="border-b border-gray-200 dark:border-gray-700 px-4 py-2" style="background-color: var(--bg-ui);">
      <div class="flex gap-2">
        <button
          v-for="(page, index) in landingPage.pages"
          :key="index"
          @click="selectedPageIndex = index"
          class="px-3 py-1.5 text-sm rounded-md border transition-colors"
          :class="selectedPageIndex === index
            ? 'bg-primary text-white border-primary dark:bg-black dark:text-white dark:border-white'
            : 'bg-transparent border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'"
        >
          Page {{ index + 1 }}
        </button>
      </div>
    </div>

    <!-- Page content -->
    <div 
      v-if="currentPage"
      class="relative flex-1 min-h-0 bg-gray-100 dark:bg-gray-950 flex items-center justify-center overflow-auto"
    >
      <div :class="[
        'transition-all duration-300 bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-auto my-4 h-full',
        {
          'w-[450px]': viewMode === 'mobile',
          'w-[820px]': viewMode === 'tablet',
          'w-full rounded-none shadow-none my-0': viewMode === 'desktop'
        }
      ]">
        <div class="flex-1 overflow-auto p-4">
          <div 
            class="prose dark:prose-invert max-w-none"
            v-html="currentPage.template"
          />
        </div>
      </div>
    </div>
  </div>
</template>

