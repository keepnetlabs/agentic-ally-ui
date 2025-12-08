<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LandingPage } from '../types/chat'

const props = defineProps<{
  landingPage: LandingPage
}>()

const selectedPageIndex = ref(0)

const hasMultiplePages = computed(() => props.landingPage.pages.length === 2)

const currentPage = computed(() => props.landingPage.pages[selectedPageIndex.value])
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-900">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-sm">{{ landingPage.name || 'Landing Page' }}</h3>
          <p class="text-xs text-muted-foreground mt-1">{{ landingPage.method }}</p>
        </div>
      </div>
    </div>

    <!-- Tabs for 2 pages -->
    <div v-if="hasMultiplePages" class="border-b border-gray-200 dark:border-gray-800 px-4 py-2 bg-gray-50 dark:bg-gray-900">
      <div class="flex gap-2">
        <button
          v-for="(page, index) in landingPage.pages"
          :key="index"
          @click="selectedPageIndex = index"
          class="px-3 py-1.5 text-sm rounded-md border transition-colors"
          :class="selectedPageIndex === index
            ? 'bg-primary text-white border-primary'
            : 'bg-transparent border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'"
        >
          Page {{ index + 1 }}
        </button>
      </div>
    </div>

    <!-- Page content -->
    <div 
      v-if="currentPage"
      class="flex-1 overflow-auto p-4"
    >
      <div 
        class="prose dark:prose-invert max-w-none"
        v-html="currentPage.template"
      />
    </div>
  </div>
</template>

