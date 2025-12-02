<script setup lang="ts">
const props = defineProps<{
  emailHtml: string
  index?: number
  totalCount?: number
  isCanvasVisible: boolean
}>()

const emit = defineEmits<{
  open: [emailHtml: string]
  toggle: [emailHtml: string]
}>()
</script>

<template>
  <div class="mb-2">
    <div class="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="text-xs flex items-center gap-2">
          <UIcon name="i-lucide-mail" class="w-3.5 h-3.5" />
          <span class="font-medium">Phishing Email Preview</span>
          <span v-if="totalCount && totalCount > 1" class="text-muted-foreground">
            ({{ (index ?? 0) + 1 }}/{{ totalCount }})
          </span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="soft"
            :icon="isCanvasVisible ? 'i-lucide-refresh-cw' : 'i-lucide-external-link'"
            @click.stop="emit('open', emailHtml)"
          >
            {{ isCanvasVisible ? 'Reload' : 'Open' }}
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            :icon="isCanvasVisible ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
            @click.stop="emit('toggle', emailHtml)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

