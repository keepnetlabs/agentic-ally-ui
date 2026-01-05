<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  body: string
  from?: string
  to?: string
  subject?: string
  messageId?: string
  chatId?: string
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
  refresh: [messageId: string, newContent: string]
  edit: []
}>()

const emailViewMode = ref<'mobile' | 'tablet' | 'desktop'>('desktop')

const setEmailViewMode = (mode: 'mobile' | 'tablet' | 'desktop') => {
  emailViewMode.value = mode
}

const openHTMLEditor = () => {
  // Will be handled by parent
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Email Header -->
    <div class="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between" style="background-color: var(--bg-ui);">
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-mail" class="w-5 h-5" />
        <div class="text-xs text-muted-foreground space-y-1">
          <div><strong>From:</strong> {{ from || 'sender@example.com' }}</div>
          <div><strong>To:</strong> {{ to || 'recipient@example.com' }}</div>
          <div><strong>Subject:</strong> {{ subject || 'Email Subject' }}</div>
        </div>
      </div>

      <!-- View Mode Buttons -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
          <UTooltip text="Mobile view">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-smartphone"
              :color="emailViewMode === 'mobile' ? 'primary' : 'neutral'"
              @click="setEmailViewMode('mobile')"
            />
          </UTooltip>
          <UTooltip text="Tablet view">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-tablet"
              :color="emailViewMode === 'tablet' ? 'primary' : 'neutral'"
              @click="setEmailViewMode('tablet')"
            />
          </UTooltip>
          <UTooltip text="Desktop view">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-monitor"
              :color="emailViewMode === 'desktop' ? 'primary' : 'neutral'"
              @click="setEmailViewMode('desktop')"
            />
          </UTooltip>
        </div>
        <UTooltip text="Edit HTML">
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-pencil"
            @click="$emit('edit')"
          />
        </UTooltip>
        <UTooltip text="Close">
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            @click="$emit('close')"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Email Body -->
    <div class="flex-1 min-h-0 bg-gray-100 dark:bg-gray-950 flex items-center justify-center overflow-auto p-4">
      <div :class="[
        'bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-auto transition-all duration-300 h-full',
        {
          'w-[450px]': emailViewMode === 'mobile',
          'w-[820px]': emailViewMode === 'tablet',
          'w-full rounded-none shadow-none': emailViewMode === 'desktop'
        }
      ]">
        <div class="prose dark:prose-invert max-w-none p-6" style="pointer-events: none; user-select: none;">
          <div v-html="body"></div>
        </div>
      </div>
    </div>
  </div>
</template>
