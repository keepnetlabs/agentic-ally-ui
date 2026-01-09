<template>
  <div ref="containerRef" class="w-full h-full min-h-0 flex flex-col bg-default border-l border-gray-200 dark:border-gray-700">
    <!-- Canvas Content Area -->
    <div class="flex-1 min-h-0 p-0 overflow-hidden">
      <div v-if="!content" class="h-full flex items-center justify-center text-muted-foreground">
        <div class="text-center">
          <UIcon name="i-lucide-canvas" class="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p class="text-sm">Canvas is ready</p>
          <p class="text-xs opacity-75">Content will appear here when triggered from chat</p>
        </div>
      </div>
      
      <div class="h-full" v-else>
        <!-- Preview Content -->
        <div v-if="content.type === 'preview'" class="space-y-4">
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 class="font-medium mb-2">{{ content.title || 'Preview' }}</h4>
            <div class="prose dark:prose-invert max-w-none">
              <div v-html="content.html"></div>
            </div>
          </div>
        </div>

        <!-- Email Template -->
        <EmailCanvas
          v-if="content.type === 'email'"
          :body="content.body || ''"
          :from="content.from"
          :to="content.to"
          :subject="content.subject"
          :message-id="content.messageId"
          :chat-id="content.chatId"
          @close="$emit('close')"
          @refresh="(messageId, newContent) => $emit('refresh', messageId, newContent)"
          @edit="openHTMLEditor('email')"
        />

        <!-- Code Preview -->
        <div v-else-if="content.type === 'code'" class="space-y-4">
          <div class="bg-gray-900 rounded-lg overflow-hidden">
            <div class="bg-gray-800 px-4 py-2 flex items-center justify-between">
              <div class="text-sm text-gray-300">{{ content.filename || 'code.js' }}</div>
              <UButton
                variant="ghost"
                size="sm"
                icon="i-lucide-copy"
                @click="copyCode"
                class="text-gray-400 hover:text-white"
              />
            </div>
            <pre class="p-4 text-sm text-gray-100 overflow-x-auto"><code>{{ content.code }}</code></pre>
          </div>
        </div>

        <!-- URL Preview -->
        <div v-else-if="content.type === 'url'" class="h-full min-h-0 flex flex-col">
          <div class="bg-white dark:bg-gray-900 border-0 rounded-none flex-1 min-h-0 flex flex-col">
            <!-- URL Header -->
            <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between" style="background-color: var(--bg-ui);">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-globe" class="w-4 h-4" />
                <div class="text-sm font-medium truncate">{{ content.title }}</div>
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
                <UTooltip text="Open in new tab">
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-external-link"
                    @click="openInNewTab"
                    class="text-gray-500 hover:text-gray-700"
                  />
                </UTooltip>
                <UTooltip text="Refresh">
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-refresh-cw"
                    @click="refreshIframe"
                    class="text-gray-500 hover:text-gray-700"
                  />
                </UTooltip>
                <UTooltip :text="isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen'">
                  <UButton
                    variant="ghost"
                    size="sm"
                    :icon="isFullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
                    @click="toggleFullscreen"
                    class="text-gray-500 hover:text-gray-700"
                  />
                </UTooltip>
                <UTooltip text="Close">
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-x"
                    @click="$emit('close')"
                    class="text-gray-500 hover:text-gray-700"
                  />
                </UTooltip>
              </div>
            </div>
            
            <!-- URL Content -->
            <div class="relative flex-1 min-h-0 bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
              <div :class="[
                'transition-all duration-300 bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden h-full',
                {
                  'w-[450px]': viewMode === 'mobile',
                  'w-[820px]': viewMode === 'tablet',
                  'w-full rounded-none shadow-none': viewMode === 'desktop'
                }
              ]">
                <iframe
                  ref="iframeRef"
                  :src="iframeUrl"
                  class="block w-full h-full border-0"
                  loading="lazy"
                  allowfullscreen
                  allow="accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        fullscreen;
                        geolocation;
                        gyroscope;
                        magnetometer;
                        microphone;
                        picture-in-picture;"
                  @load="onIframeLoad"
                  @error="onIframeError"
                />
              </div>
              
              <!-- Loading State -->
              <div v-if="iframeLoading" class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div class="text-center">
                  <UIcon name="i-lucide-loader-2" class="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p class="text-sm text-muted-foreground">Loading website...</p>
                </div>
              </div>
              
              <!-- Error State -->
              <div v-if="iframeError" class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div class="text-center">
                  <UIcon name="i-lucide-alert-circle" class="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p class="text-sm text-muted-foreground mb-2">Failed to load website</p>
                  <UButton
                    variant="soft"
                    size="sm"
                    icon="i-lucide-external-link"
                    @click="openInNewTab"
                  >
                    Open in new tab
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Landing Page -->
        <div v-else-if="content.type === 'landing-page' && content.landingPage" class="h-full min-h-0 flex flex-col">
          <LandingPageCanvas
            :landing-page="content.landingPage"
            :message-id="content.messageId"
            :chat-id="content.chatId"
            @close="$emit('close')"
            @refresh="(messageId, newContent) => $emit('refresh', messageId, newContent)"
          />
        </div>

        <!-- Generic Content -->
        <div v-else class="prose dark:prose-invert max-w-none">
          <div v-html="content.html || content.content"></div>
        </div>
      </div>
    </div>

    <!-- HTML Editor Modal -->
    <HTMLEditorModal
      v-if="showHTMLEditor && editingContent"
      :html="editingContent.html"
      :type="editingContent.type"
      @save="handleEditorSave"
      @close="handleEditorClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useRouteParams } from '../composables/useRouteParams'
import type { LandingPage, ServerMessage } from '../types/chat'

interface CanvasContent {
  type: 'preview' | 'email' | 'code' | 'html' | 'markdown' | 'url' | 'landing-page'
  title?: string
  content?: string
  html?: string
  body?: string
  code?: string
  filename?: string
  from?: string
  to?: string
  subject?: string
  url?: string
  landingPage?: LandingPage
  messageId?: string
  chatId?: string
  emailData?: { template: string; fromAddress?: string; fromName?: string; subject?: string }
}

const emit = defineEmits<{
  close: []
  clear: []
  refresh: [messageId: string, newContent: string]
}>()

const content = ref<CanvasContent | null>(null)
const { copy } = useClipboard()
const { accessToken, baseApiUrl } = useRouteParams()

// Build iframe URL with accessToken and baseApiUrl from route query
const iframeUrl = computed(() => {
  if (!content.value?.url) return ''

  try {
    const url = new URL(content.value.url)

    if (accessToken.value) {
      url.searchParams.append('accessToken', accessToken.value)
    }

    if (baseApiUrl.value) {
      url.searchParams.append('baseApiUrl', baseApiUrl.value)
    }

    return url.toString()
  } catch {
    // If URL parsing fails, return original URL
    return content.value.url
  }
})

// URL iframe handling
const iframeRef = ref()
const iframeLoading = ref(false)
const iframeError = ref(false)

// Listen for canvas events
const updateContent = (newContent: CanvasContent) => {
  content.value = newContent
  
  // Reset iframe state when new content is loaded
  if (newContent.type === 'url') {
    iframeLoading.value = true
    iframeError.value = false
  }
}

const clearContent = () => {
  content.value = null
  // Reset iframe state
  iframeLoading.value = false
  iframeError.value = false
  emit('clear')
}

const copyCode = () => {
  if (content.value?.code) {
    copy(content.value.code)
  }
}

const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const viewMode = ref<'mobile' | 'tablet' | 'desktop'>('desktop')
const showHTMLEditor = ref(false)
const editingContent = ref<{ html: string; type: 'email' | 'landing-page' } | null>(null)

const onFsChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

const setViewMode = (mode: 'mobile' | 'tablet' | 'desktop') => {
  viewMode.value = mode
}

const toggleFullscreen = async () => {
  try {
    if (!isFullscreen.value) {
      await containerRef.value?.requestFullscreen?.()
    } else {
      await document.exitFullscreen?.()
    }
  } catch {}
}


onMounted(() => {
  document.addEventListener('fullscreenchange', onFsChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
})

// URL iframe methods
const onIframeLoad = () => {
  iframeLoading.value = false
  iframeError.value = false
}

const onIframeError = () => {
  iframeLoading.value = false
  iframeError.value = true
}

const refreshIframe = () => {
  if (iframeRef.value && iframeUrl.value) {
    iframeLoading.value = true
    iframeError.value = false
    const currentUrl = iframeUrl.value
    iframeRef.value.src = ''
    setTimeout(() => {
      if (iframeRef.value) {
        iframeRef.value.src = currentUrl
      }
    }, 100)
  }
}

const openInNewTab = () => {
  if (iframeUrl.value) {
    try {
      const url = new URL(iframeUrl.value)
      // Remove accessToken and t parameters for security - don't send sensitive tokens to new tabs
      url.searchParams.delete('accessToken')
      url.searchParams.delete('t') // Remove timestamp parameter
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
    } catch {
      // If URL parsing fails, use regex to remove accessToken and t parameters
      const urlWithoutParams = iframeUrl.value
        .replace(/[?&](accessToken|t)=[^&]*/g, '')
        .replace(/\?&/, '?') // Clean up double separators
        .replace(/&$/, '') // Remove trailing &
      window.open(urlWithoutParams, '_blank', 'noopener,noreferrer')
    }
  }
}

const openHTMLEditor = (type: 'email' | 'landing-page') => {
  const html = type === 'email' ? content.value?.body : content.value?.html
  if (html) {
    editingContent.value = { html, type }
    showHTMLEditor.value = true
  }
}

const handleEditorSave = async (newHtml: string) => {
  if (!editingContent.value || !content.value) return

  // Capture values before async operations (to avoid race conditions)
  const contentType = editingContent.value.type
  const emailData = content.value.emailData
  const messageId = content.value.messageId
  const chatId = content.value.chatId

  // Update local content
  if (contentType === 'email') {
    content.value.body = newHtml
    // Also update emailData to keep it in sync
    if (content.value.emailData) {
      content.value.emailData.template = newHtml
    }
  } else {
    content.value.html = newHtml
  }

  // Save to backend if we have message and chat ID
  if (messageId && chatId) {
    try {
      // First, fetch the current message to preserve other content
      const currentMessage = await $fetch<ServerMessage>(`/api/chats/${chatId}/messages/${messageId}`)
      let fullContent = currentMessage?.content || ''

      // For emails, replace only the email wrapper
      if (contentType === 'email' && emailData) {
        // Update template in emailData
        const updatedEmailData = {
          ...emailData,
          template: newHtml
        }
        // Encode as base64
        const emailJson = JSON.stringify(updatedEmailData)
        const base64Email = btoa(unescape(encodeURIComponent(emailJson)))
        const newEmailWrapper = `::ui:phishing_email::${base64Email}::/ui:phishing_email::`

        // Replace the email wrapper in the full content
        if (fullContent.includes('::ui:phishing_email::')) {
          fullContent = fullContent.replace(
            /::ui:phishing_email::[\s\S]+?::\/ui:phishing_email::/g,
            newEmailWrapper
          )
        } else {
          // If no email wrapper exists, append it
          fullContent += '\n' + newEmailWrapper
        }
      }

      await $fetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: 'PUT',
        body: {
          content: fullContent
        }
      })
      console.log('Template saved successfully')

      // Emit refresh event with updated content to update local state
      emit('refresh', messageId, fullContent)
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  showHTMLEditor.value = false
  editingContent.value = null
}

const handleEditorClose = () => {
  showHTMLEditor.value = false
  editingContent.value = null
}

// Expose methods for parent components
defineExpose({
  updateContent,
  clearContent,
  setViewMode
})
</script>