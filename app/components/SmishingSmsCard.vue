<script setup lang="ts">
const props = defineProps<{
  sms: { smishingId: string; template: string; messages?: string[]; language?: string }
  isCanvasVisible: boolean
}>()

const emit = defineEmits<{
  open: [sms: typeof props.sms]
  toggle: [sms: typeof props.sms]
}>()

const previewText = computed(() => {
  const text = props.sms.template || props.sms.messages?.[0] || ''
  return text.length > 80 ? text.substring(0, 80) + '...' : text
})
</script>

<template>
  <div class="mb-2">
    <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="text-xs flex items-center gap-2">
          <UIcon name="i-lucide-smartphone" class="w-3.5 h-3.5" />
          <span class="font-medium">SMS Preview</span>
          <span class="text-muted-foreground ml-2 truncate max-w-[200px]">{{ previewText }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="soft"
            :icon="isCanvasVisible ? 'i-lucide-refresh-cw' : 'i-lucide-external-link'"
            :ui="{
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
            @click.stop="emit('open', sms)"
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
            @click.stop="emit('toggle', sms)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
