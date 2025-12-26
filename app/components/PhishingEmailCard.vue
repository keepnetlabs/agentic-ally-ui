<script setup lang="ts">
import type { PhishingEmail } from '../types/chat'

const props = defineProps<{
  email: PhishingEmail
  index?: number
  totalCount?: number
  isCanvasVisible: boolean
  isQuishing?: boolean
}>()

const emit = defineEmits<{
  open: [email: PhishingEmail]
  toggle: [email: PhishingEmail]
}>()
</script>

<template>
  <div class="mb-2">
    <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="text-xs flex items-center gap-2">
          <UIcon name="i-lucide-mail" class="w-3.5 h-3.5" />
          <span class="font-medium">{{ isQuishing ? 'Quishing Email Preview' : 'Phishing Email Preview' }}</span>
          <span v-if="totalCount && totalCount > 1" class="text-muted-foreground">
            ({{ (index ?? 0) + 1 }}/{{ totalCount }})
          </span>
          <span class="text-muted-foreground ml-2">{{ email.method }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="soft"
            :icon="isCanvasVisible ? 'i-lucide-refresh-cw' : 'i-lucide-external-link'"
            :ui="{
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
            @click.stop="emit('open', email)"
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
            @click.stop="emit('toggle', email)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

