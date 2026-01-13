<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSecureApi } from '../composables/useSecureApi'
import type { LandingPage, ServerMessage } from '../types/chat'

const props = defineProps<{
  landingPage: LandingPage
  messageId?: string
  chatId?: string
}>()

const emit = defineEmits<{
  close: []
  refresh: [messageId: string, newContent: string]
}>()

const { secureFetch } = useSecureApi()

const selectedPageIndex = ref(0)
const viewMode = ref<'mobile' | 'tablet' | 'desktop'>('desktop')
const showHTMLEditor = ref(false)
const editingHtml = ref('')

const hasMultiplePages = computed(() => props.landingPage.pages.length === 2)

const currentPage = computed(() => props.landingPage.pages[selectedPageIndex.value])

const setViewMode = (mode: 'mobile' | 'tablet' | 'desktop') => {
  viewMode.value = mode
}

const openHTMLEditor = () => {
  if (currentPage.value?.template) {
    editingHtml.value = currentPage.value.template
    showHTMLEditor.value = true
  }
}

const handleEditorSave = async (newHtml: string) => {
  if (currentPage.value) {
    currentPage.value.template = newHtml
  }

  // Save to backend if we have message and chat ID
  if (props.messageId && props.chatId) {
    try {
      // First, fetch the current message to preserve other content
      const currentMessage = await secureFetch<ServerMessage>(`/api/chats/${props.chatId}/messages/${props.messageId}`)
      let fullContent = currentMessage?.content || ''

      // Encode the entire landing page object as base64
      const landingPageJson = JSON.stringify(props.landingPage)
      const base64Content = btoa(unescape(encodeURIComponent(landingPageJson)))
      const newLandingPageWrapper = `::ui:landing_page::${base64Content}::/ui:landing_page::`

      // Replace the landing page wrapper in the full content
      if (fullContent.includes('::ui:landing_page::')) {
        fullContent = fullContent.replace(
          /::ui:landing_page::[\s\S]+?::\/ui:landing_page::/g,
          newLandingPageWrapper
        )
      } else {
        // If no landing page wrapper exists, append it
        fullContent += '\n' + newLandingPageWrapper
      }

      await secureFetch(`/api/chats/${props.chatId}/messages/${props.messageId}`, {
        method: 'PUT',
        body: {
          content: fullContent
        }
      })
      console.log('Landing page template saved successfully')

      // Emit refresh event with updated content to update local state
      emit('refresh', props.messageId!, fullContent)
    } catch (error) {
      console.error('Failed to save landing page template:', error)
    }
  }

  showHTMLEditor.value = false
}

const handleEditorClose = () => {
  showHTMLEditor.value = false
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
            <UTooltip text="Mobile view">
              <UButton
                variant="ghost"
                size="sm"
                icon="i-lucide-smartphone"
                :color="viewMode === 'mobile' ? 'primary' : 'neutral'"
                @click="setViewMode('mobile')"
                class="transition-colors"
              />
            </UTooltip>
            <UTooltip text="Tablet view">
              <UButton
                variant="ghost"
                size="sm"
                icon="i-lucide-tablet"
                :color="viewMode === 'tablet' ? 'primary' : 'neutral'"
                @click="setViewMode('tablet')"
                class="transition-colors"
              />
            </UTooltip>
            <UTooltip text="Desktop view">
              <UButton
                variant="ghost"
                size="sm"
                icon="i-lucide-monitor"
                :color="viewMode === 'desktop' ? 'primary' : 'neutral'"
                @click="setViewMode('desktop')"
                class="transition-colors"
              />
            </UTooltip>
          </div>
          <UTooltip text="Edit HTML">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-pencil"
              @click="openHTMLEditor"
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            />
          </UTooltip>
          <UTooltip text="Close">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              @click="emit('close')"
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            />
          </UTooltip>
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
            style="pointer-events: none; user-select: none;"
            v-html="currentPage.template"
          />
        </div>
      </div>
    </div>

    <!-- HTML Editor Modal -->
    <HTMLEditorModal
      v-if="showHTMLEditor"
      :html="editingHtml"
      type="landing-page"
      @save="handleEditorSave"
      @close="handleEditorClose"
    />
  </div>
</template>

