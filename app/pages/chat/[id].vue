<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useFetch, createError, refreshNuxtData } from 'nuxt/app'
// @ts-ignore - Nuxt auto-imports are typed via generated #imports during dev
import { useToast } from '#imports'
import { useLLM } from '../../composables/useLLM'
import { useCanvas } from '../../composables/useCanvas'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useClipboard } from '@vueuse/core'
import { parseAIMessage, parseAIReasoning, parseCanvasData } from '../../utils/text-utils'

type ServerMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

type ServerChat = {
  id: string
  messages: ServerMessage[]
}

const components = {
  pre: 'PreStream'
}

const route = useRoute()
const toast = useToast()
const clipboard = useClipboard()
const { model } = useLLM()
const { isCanvasVisible, toggleCanvas, hideCanvas, clearCanvasContent } = useCanvas()

const chatId = String(route.params.id)

// @ts-ignore - Nuxt allows top-level await in script setup
const { data: chat } = await useFetch<ServerChat>(`/api/chats/${chatId}`, {
  key: `chat-${chatId}`
})
console.log(chat.value)

if (!chat.value) {
  throw createError({ statusCode: 404, statusMessage: 'Chat not found', fatal: true })
}

const input = ref('')

const chatClient = new Chat({
  id: chatId,
  transport: new DefaultChatTransport({
    api: `/api/chats/${chatId}`,
    body: { model: model.value, conversationId: chatId }
  }),
  messages: (chat.value?.messages ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    parts: m.parts ?? []
  })),
  async onFinish(data: any) {
    console.log('onFinish called with:', data)
    
    // Extract the actual message from the data structure
    const message = data.message || data
    
    console.log('Extracted message:', message)
    console.log('Message role:', message?.role)
    console.log('Message id:', message?.id)
    
    // Save AI response to database
    if (message && message.role === 'assistant') {
      const content = message.content || parseAIMessage(message)
      console.log('Trying to save AI message:', {
        id: message.id,
        role: message.role,
        content: content?.substring(0, 100) + '...',
        contentLength: content?.length
      })
      
      try {
        const result = await $fetch(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          body: {
            id: message.id,
            role: 'assistant',
            content: content
          }
        })
        console.log('AI message saved successfully:', result)
      } catch (error) {
        console.error('Failed to save AI message:', error)
      }
      
      // Auto-trigger canvas for URLs in AI response
      checkAndTriggerCanvas(message)
    } else {
      console.log('Not saving - message not found or not assistant role')
      console.log('Message exists?', !!message)
      console.log('Role is assistant?', message?.role === 'assistant')
    }
    
    // Mark finished to prevent stuck loader
    lastFinishedMessageId.value = message?.id || null
  },
  onError(err: any) {
    try {
      console.error('Chat stream error:', err)
      console.error('Full error object:', JSON.stringify(err, null, 2))

      let errorMessage = 'An unknown error occurred'

      if (err?.message) {
        try {
          // Try to parse as JSON if it starts with '{'
          if (typeof err.message === 'string' && err.message[0] === '{') {
            const parsed = JSON.parse(err.message)
            errorMessage = parsed?.message || err.message
          } else {
            errorMessage = err.message
          }
        } catch (parseErr) {
          // If parsing fails, just use the message as-is
          errorMessage = err.message
        }
      } else if (typeof err === 'string') {
        errorMessage = err
      }

      toast.add({
        description: errorMessage,
        icon: 'i-lucide-alert-circle',
        color: 'error',
        duration: 0
      })
    } catch (handlerErr) {
      console.error('Error in onError handler:', handlerErr)
      toast.add({
        description: 'An error occurred while processing the stream',
        icon: 'i-lucide-alert-circle',
        color: 'error',
        duration: 0
      })
    }
  }
})

const messages = computed<any[]>(() =>
  chatClient.messages.map((m: any) => {
    const reasoning = parseAIReasoning(m)
    if (reasoning && m.role === 'assistant') {
      console.log('Message with reasoning:', {
        id: m.id,
        partsCount: m.parts?.length,
        reasoningLength: reasoning.length,
        parts: m.parts
      })
    }
    return {
      id: m.id,
      role: m.role,
      content: m.content || parseAIMessage(m),
      parts: m.parts ?? [],
      textParts: (m.parts ?? []).filter((p: any) => p && (p.type === 'text-delta' || p.type === 'text')),
      reasoning
    }
  })
)
const status = computed(() => chatClient.status)
const error = computed(() => chatClient.error)
const lastFinishedMessageId = ref<string | null>(null)

function handleSubmit() {
  if (!input.value || status.value === 'streaming') return
  chatClient.sendMessage({ text: input.value })
  input.value = ''
}

function stop() {
  // Chat class doesn't have stop method, need to use AbortController
}

function reload() {
  chatClient.regenerate()
}

const copied = ref(false)
const canvasRef = ref()

function extractTextPartsForTemplate(msg: any) {
  const provided = msg?.textParts
  if (Array.isArray(provided)) return provided
  const parts = msg?.parts || []
  return parts.filter((p: any) => p?.type === 'text-delta' || p?.type === 'text')
}

function hasDeltaParts(msg: any): boolean {
  const parts = extractTextPartsForTemplate(msg)
  return parts.some((p: any) => p?.type === 'text-delta' && (p?.delta || '') !== '')
}

function extractTrainingUrlFromMessage(msg: any): string | null {
  // Check parts first (streaming)
  const parts = extractTextPartsForTemplate(msg)
  for (const p of parts) {
    const text = p?.delta || p?.text || ''
    const m = text.match(/::ui:canvas_open::([^\s\n]+)/)
    if (m && m[1]) return m[1]
  }
  // Fallback: check final content
  const content = (msg?.content || '') + ''
  const mc = content.match(/::ui:canvas_open::([^\s\n]+)/)
  return mc && mc[1] ? mc[1] : null
}

function getSanitizedTextPartsForTemplate(msg: any) {
  return extractTextPartsForTemplate(msg).filter((p: any) => {
    const text = p?.delta || p?.text || ''
    return !/::ui:canvas_open::([^\s\n]+)/.test(text)
  })
}

function getSanitizedContentForTemplate(msg: any) {
  const content = (msg?.content || '') + ''
  return content.replace(/::ui:canvas_open::([^\s\n]+)\s*/g, '')
}

function copy(e: MouseEvent, message: any) {
  clipboard.copy(message.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function checkAndTriggerCanvas(message: any) {
  const content = message.content || parseAIMessage(message)
  if (typeof content === 'string') {
    
    // 1. Check for TrainingUrl: format (Primary)
    const trainingUrlMatch = content.match(/TrainingUrl:\s*(https?:\/\/[^\s\n]+)/i)
    if (trainingUrlMatch) {
      const capturedUrl = trainingUrlMatch[1]
      if (!capturedUrl) return
      const url = capturedUrl
      
      // Extract title if provided
      const titleMatch = content.match(/Title:\s*([^\n]+)/i)
      const title = titleMatch ? titleMatch[1] : `Training: ${new URL(url).hostname}`
      
      canvasRef.value?.updateContent({
        type: 'url',
        url: url,
        title: title
      })
      return
    }

    // 2. Fallback: SDK standard canvas data
    const canvasData = parseCanvasData(message)
    if (canvasData && canvasData.url) {
      canvasRef.value?.updateContent({
        type: 'url',
        url: canvasData.url,
        title: canvasData.title || `Website: ${new URL(canvasData.url).hostname}`
      })
      return
    }

    // 3. Fallback: Auto-detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi
    const urls = content.match(urlRegex)
    
    if (urls && urls.length > 0) {
      const url = urls[0]
      canvasRef.value?.updateContent({
        type: 'url',
        url: url,
        title: `Website: ${new URL(url).hostname}`
      })
      return
    }
    
    // 4. Fallback: Manual tags
    if (content.includes('[CANVAS:URL]') || content.includes('[CANVAS]')) {
      const urlMatch = content.match(/(https?:\/\/[^\s]+)/)
      if (urlMatch) {
        canvasRef.value?.updateContent({
          type: 'url',
          url: urlMatch[0],
          title: `Website: ${new URL(urlMatch[0]).hostname}`
        })
      }
    }
  }
}

function showInCanvas(e: MouseEvent, message: any) {
  const content = message.content
  
  // URL detection - check if content contains a URL
  const urlRegex = /(https?:\/\/[^\s]+)/gi
  const urls = content.match(urlRegex)
  
  if (urls && urls.length > 0) {
    // URL content - show in iframe
    const url = urls[0] // Use the first URL found
    canvasRef.value?.updateContent({
      type: 'url',
      url: url,
      title: `Website: ${new URL(url).hostname}`
    })
  } else if (content.includes('@') && (content.includes('Subject:') || content.includes('From:') || content.includes('To:'))) {
    // Email content
    const emailMatch = content.match(/From:\s*([^\n]+)\nTo:\s*([^\n]+)\nSubject:\s*([^\n]+)\n\n([\s\S]+)/i)
    if (emailMatch) {
      canvasRef.value?.updateContent({
        type: 'email',
        from: emailMatch[1],
        to: emailMatch[2],
        subject: emailMatch[3],
        body: emailMatch[4]
      })
    } else {
      // Simple email format
      canvasRef.value?.updateContent({
        type: 'email',
        body: content
      })
    }
  } else if (content.includes('```') || content.includes('function') || content.includes('const ') || content.includes('class ')) {
    // Code content
    const codeMatch = content.match(/```(\w+)?\n([\s\S]+?)\n```/g)
    if (codeMatch) {
      const firstMatch = codeMatch[0].match(/```(\w+)?\n([\s\S]+?)\n```/)
      canvasRef.value?.updateContent({
        type: 'code',
        code: firstMatch[2],
        filename: firstMatch[1] ? `code.${firstMatch[1]}` : 'code.txt'
      })
    } else {
      canvasRef.value?.updateContent({
        type: 'code',
        code: content
      })
    }
  } else {
    // HTML or general preview
    canvasRef.value?.updateContent({
      type: 'preview',
      title: 'AI Response',
      html: content
    })
  }
}

onMounted(() => {
  // Close canvas when entering a new chat
  if (isCanvasVisible.value) {
    hideCanvas()
  }
  
  if (chat.value?.messages.length === 1) {
    reload()
  }
})

// Reactive UI signal handling for ::ui:canvas_open::<URL>
const hasCanvasOpenedForCurrentMessage = ref(false)

async function openCanvasWithUrl(url: string, title?: string) {
  if (!url) return
  if (!isCanvasVisible.value) {
    toggleCanvas()
    await nextTick()
  }
  // Always update content, even if canvas is already visible
  await nextTick()
  
  // Force reload by updating content with a timestamp to make it unique
  const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
  
  canvasRef.value?.updateContent({
    type: 'url',
    url: urlWithTimestamp,
    title: title || `Training: ${new URL(url).hostname}`
  })
}

function getAllStreamText(message: any): string {
  const parts = extractTextPartsForTemplate(message) || []
  return parts.map((p: any) => p?.delta || p?.text || '').join('')
}

function maybeProcessUiSignals(message: any) {
  if (!message || hasCanvasOpenedForCurrentMessage.value) return
  const allText = getAllStreamText(message)
  const match = allText.match(/::ui:canvas_open::([^\s\n]+)/)
  if (match && match[1]) {
    hasCanvasOpenedForCurrentMessage.value = true
    openCanvasWithUrl(match[1])
  }
}

// Reset the processed flag whenever the last message changes
watch(() => messages.value[messages.value.length - 1]?.id, () => {
  hasCanvasOpenedForCurrentMessage.value = false
})

// Close canvas when switching to different chat
watch(() => route.params.id, () => {
  if (isCanvasVisible.value) {
    hideCanvas()
  }
  hasCanvasOpenedForCurrentMessage.value = false
})

// Close canvas when chat data changes (new chat created)
watch(() => chat.value?.id, () => {
  if (isCanvasVisible.value) {
    hideCanvas()
  }
  hasCanvasOpenedForCurrentMessage.value = false
})

// Watch streaming progress and last message parts to detect the UI signal in near real-time
watch(
  () => ({
    s: status.value,
    lastId: messages.value[messages.value.length - 1]?.id,
    lastRole: messages.value[messages.value.length - 1]?.role,
    lastParts: messages.value[messages.value.length - 1]?.parts?.length
  }),
  () => {
    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant') return
    if (status.value === 'streaming') {
      maybeProcessUiSignals(last)
    }
  },
  { deep: true }
)

// Also watch the concatenated stream text to catch updates where parts length does not change
watch(
  () => {
    const last = messages.value[messages.value.length - 1]
    return last && last.role === 'assistant' ? getAllStreamText(last) : ''
  },
  () => {
    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant') return
    if (status.value === 'streaming') {
      maybeProcessUiSignals(last)
    }
  }
)
</script>

<template>
  <UDashboardPanel id="chat" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <DashboardNavbar>
        <template #right></template>
      </DashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-[calc(100vh-var(--ui-header-height))] min-h-0 overflow-hidden">
        <!-- Chat Area -->
        <div 
          class="flex flex-col transition-all duration-300 overflow-y-auto min-h-0"
          :class="{ 'w-full lg:w-1/4': isCanvasVisible, 'flex-1': !isCanvasVisible, 'lg:pr-4': isCanvasVisible }"
        >
          <UContainer class="flex-1 flex flex-col gap-4 sm:gap-6">
            <UChatMessages
              :messages="messages"
              :status="status"
              :assistant="{ actions: [
                { label: 'Copy', icon: copied ? 'i-lucide-copy-check' : 'i-lucide-copy', onClick: copy },
                { label: 'Canvas', icon: 'i-lucide-canvas', onClick: showInCanvas }
              ] }"
              class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
              :spacing-offset="160"
            >
              <template #content="{ message }">
                <!-- Training URL UI (compact) -->
                <div v-if="extractTrainingUrlFromMessage(message)" class="mb-2">
                  <div class="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-xs">
                        <span class="font-medium">Training URL</span>
                        <span class="text-muted-foreground ml-2">{{ (extractTrainingUrlFromMessage(message) || '').replace(/^https?:\/\//, '').split('/')[0] }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <UButton
                          size="xs"
                          variant="soft"
                          :icon="isCanvasVisible ? 'i-lucide-refresh-cw' : 'i-lucide-external-link'"
                          @click.stop="openCanvasWithUrl(extractTrainingUrlFromMessage(message) || '')"
                        >
                          {{ isCanvasVisible ? 'Reload' : 'Open' }}
                        </UButton>
                        <UButton
                          size="xs"
                          variant="ghost"
                          :icon="isCanvasVisible ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
                          @click.stop="isCanvasVisible ? hideCanvas() : openCanvasWithUrl(extractTrainingUrlFromMessage(message) || '')"
                        />
                        <UButton
                          size="xs"
                          variant="ghost"
                          icon="i-lucide-copy"
                          @click.stop="copy($event, message)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Streaming: show thinking indicator -->
                <div v-if="status === 'streaming' && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id && lastFinishedMessageId !== message.id">
                  <div class="flex items-start gap-2 text-xs text-muted-foreground">
                    <UIcon name="i-lucide-brain" class="w-3.5 h-3.5 mt-0.5" />
                    <span>Thinking…</span>
                  </div>
                </div>

                <!-- Final content (non-streaming or non-last message) -->
                <div v-else class="whitespace-pre-line">
                  <MDCCached
                    :value="getSanitizedContentForTemplate(message)"
                    :cache-key="message.id"
                    unwrap="p"
                    :components="components"
                    :parser-options="{ highlight: false }"
                  />
                </div>

                <div v-if="message.reasoning && !(status === 'streaming' && message.id === messages[messages.length - 1]?.id && lastFinishedMessageId !== message.id)" class="mt-2">
                  <UCollapsible class="text-xs">
                    <template #default>
                      <UButton variant="ghost" size="xs" class="text-muted-foreground">
                        <UIcon name="i-lucide-brain" class="w-3.5 h-3.5 mr-2" />
                        Reasoning
                      </UButton>
                    </template>
                    <template #content>
                      <pre class="whitespace-pre-wrap break-words text-xs text-muted-foreground pt-2">{{ message.reasoning }}</pre>
                    </template>
                  </UCollapsible>
                </div>
              </template>
            </UChatMessages>

            <UChatPrompt
              v-model="input"
              :error="error"
              variant="subtle"
              :class="[
                'sticky bottom-0 [view-transition-name:chat-prompt] rounded-b-none z-10',
                input.length === 0 ? 'force-default-height' : ''
              ]"
              @submit="handleSubmit"
            >
              <UChatPromptSubmit
                :status="status"
                color="neutral"
                @stop="stop"
                @reload="reload"
              />

              <template #footer>
                <ModelSelect v-model="model" />
              </template>
            </UChatPrompt>
          </UContainer>
        </div>

        <!-- Canvas Area -->
        <div 
          v-if="isCanvasVisible"
          class="w-full lg:w-3/4 border-l border-gray-200 dark:border-gray-800 transition-all duration-300 sticky top-(--ui-header-height) self-start h-[calc(100vh-var(--ui-header-height))] min-h-0 overflow-hidden flex flex-col relative"
        >
          <ChatCanvas 
            ref="canvasRef"
            class="absolute inset-0 h-full w-full"
            @close="hideCanvas"
            @clear="() => clearCanvasContent()"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* Force max height when input is empty to prevent layout expansion */
:deep(.force-default-height) {
  max-height: 88px !important;
  height: 88px !important;
}

:deep(.force-default-height textarea),
:deep(.force-default-height input) {
  max-height: 36px !important;
  height: 36px !important;
  overflow: hidden;
}
</style>
