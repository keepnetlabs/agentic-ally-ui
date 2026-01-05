<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFetch, createError, refreshNuxtData } from 'nuxt/app'
// @ts-ignore - Nuxt auto-imports are typed via generated #imports during dev
import { useToast } from '#imports'
import { useLLM } from '../../composables/useLLM'
import { useCanvas } from '../../composables/useCanvas'
import { useCanvasTriggers } from '../../composables/useCanvasTriggers'
import { useChatClient } from '../../composables/useChatClient'
import { parseError } from '../../utils/error-handler'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useClipboard } from '@vueuse/core'
import { parseAIMessage, parseAIReasoning } from '../../utils/text-utils'
import { extractTrainingUrlFromMessage, extractAllPhishingEmailsFromMessage, extractLandingPageFromMessage, getSanitizedContentForTemplate, getAllStreamText, showInCanvas as showInCanvasUtil } from '../../utils/message-utils'
import { useChatNavigation } from '../../composables/useChatNavigation'
import { exponentialBackoffWithJitter, DEFAULT_RETRY_CONFIG, type RetryConfig } from '../../utils/retry-handler'
import type { ServerChat } from '../../types/chat'

const components = {
  pre: 'PreStream'
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const clipboard = useClipboard()
const { model } = useLLM()
const { isCanvasVisible, toggleCanvas, hideCanvas, clearCanvasContent } = useCanvas()
const { getModelConfig, createHandleSubmit, createStop, createReload, createMessages, createStatus, createErrorComputed } = useChatClient()

const chatId = String(route.params.id)

// Get sessionId from URL query (passed by parent iframe)
const sessionId = route.query.sessionId as string

const chatUrl = sessionId ? `/api/chats/${chatId}?sessionId=${sessionId}` : `/api/chats/${chatId}`

/**
 * Save message with exponential backoff + jitter retry
 * Industry standard pattern (Netflix, AWS, Google)
 */
const saveMessageWithRetry = async (
  messageId: string,
  content: string,
  attempt = 0,
  startTime = Date.now(),
  config: RetryConfig = DEFAULT_RETRY_CONFIG
) => {
  const maxRetries = config.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries!
  const deadline = config.deadline || DEFAULT_RETRY_CONFIG.deadline!

  try {
    const messagesUrl = sessionId
      ? `/api/chats/${chatId}/messages?sessionId=${sessionId}`
      : `/api/chats/${chatId}/messages`

    await $fetch(messagesUrl, {
      method: 'POST',
      body: {
        id: messageId,
        role: 'assistant',
        content: content
      },
      headers: {
        ...(accessToken ? { 'X-AGENTIC-ALLY-TOKEN': accessToken } : {}),
        ...(companyId ? { 'X-COMPANY-ID': companyId } : {})
      }
    })

    // Success - silent success, no toast (only notify on errors)
    console.log('AI message saved successfully')
    return true
  } catch (error) {
    const elapsed = Date.now() - startTime

    // Check deadline first
    if (elapsed > deadline) {
      console.error('Message save deadline exceeded after', attempt, 'attempts')
      const { title, message, icon } = parseError(error)
      toast.add({
        title: 'Failed to save message',
        description: `${message} (timeout after ${attempt} attempts)`,
        icon,
        color: 'error',
        duration: 0
      })
      return false
    }

    // Check max retries
    if (attempt >= maxRetries) {
      console.error('Max retries exceeded for message save')
      const { title, message, icon } = parseError(error)
      toast.add({
        title: 'Failed to save message',
        description: `${message} (${maxRetries} attempts failed)`,
        icon,
        color: 'error',
        duration: 0
      })
      return false
    }

    // Calculate backoff delay with jitter
    const delay = exponentialBackoffWithJitter(attempt)

    // Show retry progress
    console.log(`Message save failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`)
    toast.add({
      title: 'Retrying...',
      description: `Attempt ${attempt + 1}/${maxRetries}`,
      icon: 'i-lucide-loader',
      color: 'warning'
    })

    // Auto-retry with delay
    await new Promise(resolve => setTimeout(resolve, delay))
    return saveMessageWithRetry(messageId, content, attempt + 1, startTime, config)
  }
}

// @ts-ignore - Nuxt allows top-level await in script setup
const { data: chat } = await useFetch<ServerChat>(chatUrl, {
  key: `chat-${chatId}`,
  credentials: 'include'  // Allow cookies in cross-origin requests
})
console.log(chat.value)

if (!chat.value) {
  throw createError({ statusCode: 404, statusMessage: 'Chat not found', fatal: true })
}

const input = ref('')

const streamUrl = sessionId ? `/api/chats/${chatId}?sessionId=${sessionId}` : `/api/chats/${chatId}`
const accessToken = route.query.accessToken as string
const companyId = route.query.companyId as string

const chatClient = new Chat({
  id: chatId,
  transport: new DefaultChatTransport({
    api: streamUrl,
    body: { ...getModelConfig(model.value), conversationId: chatId },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(accessToken ? { 'X-AGENTIC-ALLY-TOKEN': accessToken } : {}),
          ...(companyId ? { 'X-COMPANY-ID': companyId } : {})
        }
      })
    }
  }),
  messages: (chat.value?.messages ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    parts: m.parts ?? []
  })),
  async onFinish(data: any) {
    // Extract the actual message from the data structure
    const message = data.message || data

    // Save AI response to database with retry logic
    if (message && message.role === 'assistant') {
      const content = message.content || parseAIMessage(message)

      // Save with exponential backoff retry
      await saveMessageWithRetry(message.id, content)

      // Auto-trigger canvas for URLs in AI response
      checkAndTriggerCanvas(message)
    }

    // Mark finished to prevent stuck loader
    lastFinishedMessageId.value = message?.id || null
  },
  onError(err: any) {
    console.error('Chat stream error:', err)
    const { title, message, icon, canRetry } = parseError(err)
    toast.add({
      title,
      description: message,
      icon,
      color: 'error',
      duration: canRetry ? 0 : 5000
    })
  }
})

const messages = createMessages(chatClient, parseAIReasoning, parseAIMessage)
const status = createStatus(chatClient)
const error = createErrorComputed(chatClient)
const lastFinishedMessageId = ref<string | null>(null)

const handleSubmit = createHandleSubmit(chatClient, input, messages, status, lastFinishedMessageId)

const stop = createStop()
const reload = createReload(chatClient)

// Track streaming state for navigation
const { setStreaming } = useChatNavigation()
watch(
  () => status.value,
  (newStatus) => {
    setStreaming(chatId, newStatus === 'streaming', stop)
  }
)

const copied = ref(false)
const canvasRef = ref()
const { openCanvasWithUrl, openCanvasWithEmail, openCanvasWithLandingPage, checkAndTriggerCanvas, maybeProcessUiSignals, hasCanvasOpenedForCurrentMessage, hasEmailRenderedForCurrentMessage } = useCanvasTriggers(canvasRef, isCanvasVisible, toggleCanvas, hideCanvas, messages, route, chat, status)

// Compute assistant config with conditional actions based on streaming state
const assistantConfig = computed(() => {
  // Check if the last message is currently streaming
  const lastMessage = messages.value[messages.value.length - 1]
  const isStreaming = status.value === 'streaming' &&
    lastMessage?.role === 'assistant' &&
    lastMessage?.id !== null &&
    lastFinishedMessageId.value !== lastMessage?.id

  return {
    actions: isStreaming ? [] : [
      { label: 'Copy', icon: copied.value ? 'i-lucide-copy-check' : 'i-lucide-copy', onClick: copy },
      { label: 'Canvas', icon: 'i-lucide-canvas', onClick: showInCanvas }
    ]
  }
})

function copy(e: MouseEvent | null, message: any) {
  clipboard.copy(message.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function copyTrainingUrl(message: any) {
  const url = extractTrainingUrlFromMessage(message)
  if (url) {
    clipboard.copy(url)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

const showInCanvas = (e: MouseEvent, message: any) => {
  showInCanvasUtil(canvasRef, message.content)
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

function handleCanvasRefresh(messageId: string, newContent: string) {
  // Update chat.value messages
  if (chat.value?.messages) {
    const message = chat.value.messages.find((m: any) => m.id === messageId)
    if (message) {
      message.content = newContent
    }
  }
  // Update Chat client's internal messages array (critical for regenerate)
  const clientMessage = chatClient.messages.find((m: any) => m.id === messageId)
  if (clientMessage) {
    clientMessage.content = newContent
  }
}

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
              :assistant="assistantConfig"
              class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
              :spacing-offset="160"
            >
              <template #content="{ message }">
                <!-- Landing Page UI -->
                <LandingPageCard
                  v-if="extractLandingPageFromMessage(message)"
                  :landing-page="extractLandingPageFromMessage(message)"
                  :is-canvas-visible="isCanvasVisible"
                  @open="(landingPage) => openCanvasWithLandingPage(landingPage, message.id)"
                  @toggle="(landingPage) => isCanvasVisible ? hideCanvas() : openCanvasWithLandingPage(landingPage, message.id)"
                />

                <!-- Training URL UI -->
                <TrainingUrlCard
                  v-if="extractTrainingUrlFromMessage(message)"
                  :url="extractTrainingUrlFromMessage(message) || ''"
                  :is-canvas-visible="isCanvasVisible"
                  @open="openCanvasWithUrl"
                  @toggle="(url) => isCanvasVisible ? hideCanvas() : openCanvasWithUrl(url)"
                  @copy="() => copyTrainingUrl(message)"
                />

                <!-- Phishing Email UI - show all emails -->
                <PhishingEmailCard
                  v-for="(email, index) in extractAllPhishingEmailsFromMessage(message)"
                  :key="index"
                  :email="email"
                  :index="index"
                  :total-count="extractAllPhishingEmailsFromMessage(message).length"
                  :is-canvas-visible="isCanvasVisible"
                  :is-quishing="email.isQuishing"
                  @open="(email) => openCanvasWithEmail(email, message.id)"
                  @toggle="(email) => isCanvasVisible ? hideCanvas() : openCanvasWithEmail(email, message.id)"
                />

                <!-- Reasoning (shown above content, also during streaming) -->
                <ReasoningSection :reasoning="message.reasoning" />

                <!-- Streaming: show thinking indicator -->
                <StreamingIndicator 
                  :is-streaming="status === 'streaming' && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id && lastFinishedMessageId !== message.id"
                />

                <!-- Final content (non-streaming or non-last message) -->
                <div v-if="!(status === 'streaming' && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id && lastFinishedMessageId !== message.id)" class="whitespace-pre-line">
                  <MDCCached
                    :value="getSanitizedContentForTemplate(message)"
                    :cache-key="message.id"
                    unwrap="p"
                    :components="components"
                    :parser-options="{ highlight: false }"
                  />
                </div>
              </template>
            </UChatMessages>

            <UChatPrompt
              v-model="input"
              :error="error"
              variant="subtle"
              autocomplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              :class="[
                'sticky bottom-2 [view-transition-name:chat-prompt] z-10 chat-prompt-custom',
                input.length === 0 ? 'force-default-height' : ''
              ]"
              @submit="handleSubmit"
            >
              <UChatPromptSubmit
                :status="status"
                color="info"
                :ui="{ 
                  base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
                }"
                @stop="stop"
                @reload="reload"
              />

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
            class="flex-1 min-h-0"
            @close="hideCanvas"
            @clear="() => clearCanvasContent()"
            @refresh="handleCanvasRefresh"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.chat-prompt-custom {
  border-radius: 8px !important;
}

:deep(.chat-prompt-custom) {
  border-radius: 8px !important;
}

/* Force max height when input is empty to prevent layout expansion */
:deep(.force-default-height) {
  max-height: 48px !important;
  height: 48px !important;
  justify-content: center;
}

:deep(.force-default-height textarea),
:deep(.force-default-height input) {
  max-height: 32px !important;
  height: 32px !important;
  overflow: hidden;
}
</style>
