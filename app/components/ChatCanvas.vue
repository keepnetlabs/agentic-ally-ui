<template>
  <div ref="containerRef" class="w-full h-full min-h-0 flex flex-col bg-default border-l border-gray-200 dark:border-gray-800">
    <!-- Canvas Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-canvas" class="w-4 h-4" />
        <h3 class="font-medium">Canvas</h3>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          variant="ghost"
          size="sm"
          :icon="isFullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          @click="toggleFullscreen"
        />
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          @click="$emit('close')"
        />
      </div>
    </div>

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
        <div v-else-if="content.type === 'email'" class="space-y-4">
          <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <!-- Email Header -->
            <div class="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div class="text-xs text-muted-foreground space-y-1">
                <div><strong>From:</strong> {{ content.from || 'sender@example.com' }}</div>
                <div><strong>To:</strong> {{ content.to || 'recipient@example.com' }}</div>
                <div><strong>Subject:</strong> {{ content.subject || 'Email Subject' }}</div>
              </div>
            </div>
            
            <!-- Email Body -->
            <div class="p-4">
              <div class="prose dark:prose-invert max-w-none">
                <div v-html="content.body"></div>
              </div>
            </div>
          </div>
        </div>

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
            <div class="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-globe" class="w-4 h-4" />
                <div class="text-sm font-medium truncate">{{ content.title }}</div>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-external-link"
                  @click="openInNewTab"
                  class="text-gray-500 hover:text-gray-700"
                />
                <UButton
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-refresh-cw"
                  @click="refreshIframe"
                  class="text-gray-500 hover:text-gray-700"
                />
              </div>
            </div>
            
            <!-- URL Content -->
            <div class="relative flex-1 min-h-0">
              <iframe
                ref="iframeRef"
                :src="content.url"
                class="block w-full h-full min-h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                loading="lazy"
                @load="onIframeLoad"
                @error="onIframeError"
              />
              
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

        <!-- Generic Content -->
        <div v-else class="prose dark:prose-invert max-w-none">
          <div v-html="content.html || content.content"></div>
        </div>
      </div>
    </div>

    <!-- Canvas Footer removed per requirements -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useClipboard } from '@vueuse/core'

interface CanvasContent {
  type: 'preview' | 'email' | 'code' | 'html' | 'markdown' | 'url'
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
}

const emit = defineEmits<{
  close: []
  edit: [content: CanvasContent]
  clear: []
}>()

const content = ref<CanvasContent | null>(null)
const { copy } = useClipboard()

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

const editContent = () => {
  if (content.value) {
    emit('edit', content.value)
  }
}

const copyCode = () => {
  if (content.value?.code) {
    copy(content.value.code)
  }
}

const downloadContent = () => {
  if (!content.value) return
  
  let filename = 'canvas-content'
  let data = ''
  let type = 'text/plain'
  
  switch (content.value.type) {
    case 'email':
      filename = `${content.value.subject || 'email'}.html`
      data = generateEmailHTML(content.value)
      type = 'text/html'
      break
    case 'code':
      filename = content.value.filename || 'code.txt'
      data = content.value.code || ''
      break
    case 'html':
    case 'preview':
      filename = `${content.value.title || 'preview'}.html`
      data = content.value.html || content.value.content || ''
      type = 'text/html'
      break
    default:
      data = content.value.content || content.value.html || ''
  }
  
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const generateEmailHTML = (emailContent: CanvasContent) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${emailContent.subject || 'Email'}</title>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
    <div style="background: #f5f5f5; padding: 15px; border-bottom: 1px solid #ddd;">
      <div style="font-size: 12px; color: #666;">
        <div><strong>From:</strong> ${emailContent.from || 'sender@example.com'}</div>
        <div><strong>To:</strong> ${emailContent.to || 'recipient@example.com'}</div>
        <div><strong>Subject:</strong> ${emailContent.subject || 'Email Subject'}</div>
      </div>
    </div>
    <div style="padding: 20px;">
      ${emailContent.body || emailContent.content || ''}
    </div>
  </div>
</body>
</html>`
}

const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

const onFsChange = () => {
  isFullscreen.value = !!document.fullscreenElement
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
  if (iframeRef.value && content.value?.url) {
    iframeLoading.value = true
    iframeError.value = false
    iframeRef.value.src = content.value.url
  }
}

const openInNewTab = () => {
  if (content.value?.url) {
    window.open(content.value.url, '_blank', 'noopener,noreferrer')
  }
}

// Expose methods for parent components
defineExpose({
  updateContent,
  clearContent
})
</script>