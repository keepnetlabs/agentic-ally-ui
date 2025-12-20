<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  url: string
  isCanvasVisible: boolean
}>()

const emit = defineEmits<{
  open: [url: string]
  toggle: [url: string]
  copy: []
}>()

const displayUrl = computed(() => {
  return props.url.replace(/^https?:\/\//, '').split('/')[0]
})
</script>

<template>
  <div class="mb-2">
    <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="text-xs">
          <span class="font-medium">Training URL</span>
          <span class="text-muted-foreground ml-2">{{ displayUrl }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="soft"
            :icon="isCanvasVisible ? 'i-lucide-refresh-cw' : 'i-lucide-external-link'"
            :ui="{
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
            @click.stop="emit('open', url)"
          >
            {{ isCanvasVisible ? 'Reload' : 'Open' }}
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            :icon="isCanvasVisible ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
            :ui="{
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
            @click.stop="emit('toggle', url)"
          />
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-copy"
            :ui="{
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
            @click.stop="emit('copy')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

