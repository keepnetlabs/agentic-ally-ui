<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useFetch, createError } from 'nuxt/app'
import { useToast } from '#imports'
import { useLLM } from '../../composables/useLLM'
import { useCanvas } from '../../composables/useCanvas'
import { useCanvasTriggers } from '../../composables/useCanvasTriggers'
import { useChatClient } from '../../composables/useChatClient'
import { useRouteParams } from '../../composables/useRouteParams'
import { useAuthToken } from '../../composables/useAuthToken'
import { useSecureApi } from '../../composables/useSecureApi'
import { useApiHeaders } from '../../composables/useApiHeaders'
import { parseError } from '../../utils/error-handler'
import { getPromptInputElement } from '../../utils/prompt-utils'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useClipboard } from '@vueuse/core'
import { parseAIMessage, parseAIReasoning } from '../../utils/text-utils'
import { useUiSignalsSync } from '../../composables/useUiSignalsSync'
import {
  extractTrainingUrlFromMessage,
  extractAllPhishingEmailsFromMessage,
  extractLandingPageFromMessage,
  extractAvatarSelectionFromMessage,
  extractVoiceSelectionFromMessage,
  extractReportFromMessage,
  type AvatarSelectionPayload,
  type VoiceSelectionPayload,
  type VishingNextStepItem,
  type ReportCardPayload,
  getSanitizedContentForTemplate,
  getAllStreamText,
  showInCanvas as showInCanvasUtil
} from '../../utils/message-utils'
import { useMentions } from '../../composables/useMentions'
import { useVishingPolling } from '../../composables/useVishingPolling'
import { useDeepfakePolling } from '../../composables/useDeepfakePolling'
import { useExternalPrompt } from '../../composables/useExternalPrompt'
import { useChatNavigation } from '../../composables/useChatNavigation'
import { exponentialBackoffWithJitter, DEFAULT_RETRY_CONFIG, type RetryConfig } from '../../utils/retry-handler'
import type { ServerChat } from '../../types/chat'

const components = {
  pre: 'PreStream'
}

const route = useRoute()
const toast = useToast()
const clipboard = useClipboard()
const { model } = useLLM()
const { isCanvasVisible, toggleCanvas, hideCanvas, clearCanvasContent } = useCanvas()
const { getModelConfig, createHandleSubmit, createStop, createReload, createMessages, createStatus, createErrorComputed } = useChatClient()
const { buildUrl, sessionId } = useRouteParams()
const { token: accessToken, clearToken } = useAuthToken()
const { secureFetch } = useSecureApi()
const { apiHeaders } = useApiHeaders()

const chatId = String(route.params.id)

// Temporarily force Main Assistant for the production release.
// Restore the original line below after the build if Customer Service should come back.
// const BOT_TYPE_KEY = 'agentic-ally-bot-type'
// const botType = (route.query.botType as string) || (typeof window !== 'undefined' ? localStorage.getItem(BOT_TYPE_KEY) : null) || 'chat'

const chatUrl = buildUrl(`/api/chats/${chatId}`)

const isComponentActive = ref(true)

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
  if (!isComponentActive.value) {
    return false
  }
  const maxRetries = config.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries!
  const deadline = config.deadline || DEFAULT_RETRY_CONFIG.deadline!

  try {
    const messagesUrl = buildUrl(`/api/chats/${chatId}/messages`)

    await secureFetch(messagesUrl, {
      method: 'POST',
      body: {
        id: messageId,
        role: 'assistant',
        content: content
      },
      headers: apiHeaders.value
    })

    // Success - silent success, no toast (only notify on errors)
    console.log('AI message saved successfully')
    if (!isComponentActive.value) {
      return false
    }
    return true
  } catch (error) {
    if (!isComponentActive.value) {
      return false
    }
    const elapsed = Date.now() - startTime

    // Check deadline first
    if (elapsed > deadline) {
      console.error('Message save deadline exceeded after', attempt, 'attempts')
      const { message, icon } = parseError(error)
      toast.add({
        id: 'message-save-error',
        title: 'Failed to save message',
        description: `${message} (timeout after ${attempt} attempts)`,
        icon,
        color: 'error',
        duration: 15000
      })
      return false
    }

    // Check max retries
    if (attempt >= maxRetries) {
      console.error('Max retries exceeded for message save')
      const { message, icon } = parseError(error)
      toast.add({
        id: 'message-save-error',
        title: 'Failed to save message',
        description: `${message} (${maxRetries} attempts failed)`,
        icon,
        color: 'error',
        duration: 15000
      })
      return false
    }

    // Calculate backoff delay with jitter
    const delay = exponentialBackoffWithJitter(attempt)

    // Show retry progress (same ID so each retry updates the existing toast)
    console.log(`Message save failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`)
    toast.add({
      id: 'message-save-retry',
      title: 'Retrying...',
      description: `Attempt ${attempt + 1}/${maxRetries}`,
      icon: 'i-lucide-loader',
      color: 'warning'
    })

    // Auto-retry with delay
    await new Promise(resolve => setTimeout(resolve, delay))
    if (!isComponentActive.value) {
      return false
    }
    return saveMessageWithRetry(messageId, content, attempt + 1, startTime, config)
  }
}

const chatHeaders = computed(() => ({
  ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {})
}))

const { data: chat, refresh: refreshChat } = await useFetch<ServerChat>(chatUrl, {
  key: `chat-${chatId}`,
  immediate: false,
  lazy: true,
  credentials: 'include', // Allow cookies in cross-origin requests
  headers: chatHeaders,
  onResponseError({ response }) {
    if (response?.status === 401 && accessToken.value) {
      toast.add({
        title: 'Unauthorized',
        description: 'Please authenticate again.',
        icon: 'i-lucide-shield-alert',
        color: 'error'
      })
    }
  }
})

const hasFetchedChat = ref(false)
const refreshChatSafe = async () => {
  await refreshChat()
  hasFetchedChat.value = true
}

watch([accessToken, sessionId], ([tokenValue, sessionValue]) => {
  if (!tokenValue || !sessionValue) {
    return
  }
  refreshChatSafe()
})

if (accessToken.value && sessionId.value) {
  refreshChatSafe()
}

watch([hasFetchedChat, chat], ([hasFetched, value]) => {
  if (hasFetched && !value) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found', fatal: true })
  }
})

const input = ref('')
const {
  promptRef,
  promptContainerRef,
  mentionListRef,
  mentionOpen,
  mentionResults,
  mentionIndex,
  mentionLoading,
  syncCursorIndex,
  handlePromptKeydown,
  handleMentionMouseDown,
  applyTargetTags,
  clearSelectedTargets,
  closeMentionMenu,
  getMentionInitials
} = useMentions({
  input,
  buildUrl,
  secureFetch,
  minMentionLength: 3,
  debounceMs: 500
})

const mentionDropdownRef = ref<{ listRef?: HTMLElement | null } | null>(null)
watch(() => mentionDropdownRef.value?.listRef, (el) => {
  mentionListRef.value = el ?? null
})

useExternalPrompt({ input, promptRef })

const streamSilentRetryCount = ref(0)
const MAX_SILENT_RETRIES = 2

const streamUrl = buildUrl(`/api/chats/${chatId}`)

const chatClient = new Chat({
  id: chatId,
  transport: new DefaultChatTransport({
    api: streamUrl,
    // Restore CS routing after the build if needed:
    // body: { ...getModelConfig(model.value), conversationId: chatId, ...(botType === 'cs' ? { botType: 'cs' } : {}) },
    body: { ...getModelConfig(model.value), conversationId: chatId },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}),
          ...apiHeaders.value
        }
      })

      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        clearToken()
        throw new Error('Session expired. Please authenticate again.')
      }

      return response
    }
  }),
  messages: (chat.value?.messages ?? []).map((m: { id: string, role: string, content?: string, parts?: unknown[] }) => ({
    id: m.id,
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
    parts: m.parts ?? []
  })) as unknown as InstanceType<typeof Chat>['messages'],
  async onFinish(data: Record<string, unknown>) {
    // AI SDK calls onFinish in a finally block — it fires even on errors.
    // Skip saving and state resets when the request actually failed,
    // otherwise we'd save empty messages to DB and reset the retry counter
    // mid-cycle (which was causing the infinite retry loop).
    if (data?.isError) {
      return
    }

    // Extract the actual message from the data structure
    const message = (data.message || data) as { id?: string, role?: string, content?: string }

    // Mark finished IMMEDIATELY to unblock UI (streaming indicator + prompt input).
    // Must happen before the async save which can take seconds with retries.
    lastFinishedMessageId.value = message?.id || null
    streamSilentRetryCount.value = 0
    // Keep workflow steps visible after stream ends — cleared on next stream start

    // Save AI response to database with retry logic (non-blocking for UI)
    if (message && message.role === 'assistant' && message.id) {
      const content = message.content || parseAIMessage(message)

      // Save with exponential backoff retry
      await saveMessageWithRetry(message.id, content)

      // Auto-trigger canvas for URLs in AI response
      checkAndTriggerCanvas(message)
    }
  },
  onError(err: unknown) {
    console.error('Chat stream error:', err)
    const { title, message, icon, canRetry } = parseError(err)

    // Silent retry: retry once automatically before showing error to user
    if (canRetry && streamSilentRetryCount.value < MAX_SILENT_RETRIES) {
      streamSilentRetryCount.value++
      console.log(`[stream-retry] Silent retry ${streamSilentRetryCount.value}/${MAX_SILENT_RETRIES} in 1.5s...`)
      setTimeout(() => {
        if (!isComponentActive.value) return
        chatClient.regenerate()
      }, 1500)
      return
    }

    // Max silent retries exhausted or non-retryable: show toast
    streamSilentRetryCount.value = 0

    // Clear the stuck streaming indicator by marking the last assistant message as finished
    const lastMsg = chatClient.messages[chatClient.messages.length - 1]
    if (lastMsg?.role === 'assistant' && lastMsg?.id) {
      lastFinishedMessageId.value = lastMsg.id
    }

    toast.add({
      id: 'chat-stream-error',
      title,
      description: message,
      icon,
      color: 'error',
      duration: 15000,
      actions: canRetry
        ? [{
            label: 'Retry',
            color: 'error' as const,
            variant: 'outline' as const,
            onClick: () => {
              streamSilentRetryCount.value = 0
              lastFinishedMessageId.value = null
              chatClient.regenerate()
            }
          }]
        : []
    })
  }
})

const messagesVersion = ref(0)
// MASTRA V1: Store UI signals separately (reactive Map by message ID)
const uiSignalsMap = ref<Map<string, unknown[]>>(new Map())
// Workflow step progress (keyed by workflowRunId → latest step data)
const workflowStepsMap = ref<Map<string, import('../../composables/useStreamEvents').WorkflowStepData>>(new Map())
const { updateUiSignalsFromContent } = useUiSignalsSync(uiSignalsMap.value, messagesVersion)

const baseMessages = createMessages(chatClient, parseAIReasoning, parseAIMessage, messagesVersion)

// MASTRA V1: Wrap messages to include uiSignals from reactive Map
const messages = computed(() => {
  // Access Map to make this computed reactive to Map changes
  const signalsMap = uiSignalsMap.value
  return baseMessages.value.map((m: { id: string, role?: string, content?: string, parts?: unknown[], [key: string]: unknown }) => ({
    ...m,
    uiSignals: signalsMap.get(m.id) || []
  }))
})

// Cast for UChatMessages which expects Message[] from @ai-sdk/vue (our messages have extra props like uiSignals)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatMessagesForUi = computed(() => messages.value as any)

watch(chat, (value) => {
  if (!value?.messages?.length) {
    return
  }
  chatClient.messages = value.messages.map((m: { id: string, role: string, content?: string, parts?: unknown[] }) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    parts: m.parts ?? []
  })) as unknown as typeof chatClient.messages
  messagesVersion.value += 1
})
const status = createStatus(chatClient)
const error = createErrorComputed(chatClient)
const lastFinishedMessageId = ref<string | null>(null)
const promptStatus = computed(() => {
  if (error.value && !input.value) {
    return 'error'
  }
  if (status.value === 'streaming') {
    return 'streaming'
  }
  return 'ready'
})

const handleSubmit = createHandleSubmit(chatClient, input, messages, status, lastFinishedMessageId)

const stop = createStop(chatClient)
onBeforeUnmount(() => {
  isComponentActive.value = false
  stop()
  clearAllVishingPolling()
  clearDeepfakePolling()
})
const reload = createReload(chatClient)

const handlePromptSubmit = () => {
  closeMentionMenu()
  applyTargetTags()
  // Clear previous workflow progress before starting new stream
  workflowStepsMap.value.clear()
  handleSubmit()
  clearSelectedTargets()
}

const handleCreateVishingNextStep = (nextStep: VishingNextStepItem) => {
  input.value = nextStep.prompt || `Create training about ${nextStep.title}`
  nextTick(() => getPromptInputElement(promptRef)?.focus())
}

// ─── Report Viewer + Print ───
const showReportViewer = ref(false)
const showReportPrint = ref(false)
const activeReport = ref<ReportCardPayload | null>(null)

const handleViewReport = (report: ReportCardPayload) => {
  activeReport.value = report
  showReportViewer.value = true
  // Notify parent iframe to expand
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'CANVAS_CLICK' }, '*')
  }
}

const handlePrintReport = (report?: ReportCardPayload) => {
  if (report) activeReport.value = report
  showReportViewer.value = false
  showReportPrint.value = true
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'CANVAS_CLICK' }, '*')
  }
}

function getToolArgs(part: { toolInvocation?: { args?: unknown } }): Record<string, unknown> {
  return (part.toolInvocation?.args ?? {}) as Record<string, unknown>
}

function getToolInvocationParts(msg: { parts?: Array<{ type?: string, toolInvocation?: { toolCallId?: string, toolName?: string, state?: string, args?: Record<string, unknown>, result?: unknown } }> }) {
  return (msg.parts ?? []).filter(
    p => p.type === 'tool-invocation' && p.toolInvocation?.toolName !== 'show_reasoning'
  )
}

function getAvatarPayload(messageId: string | undefined): AvatarSelectionPayload | null {
  if (!messageId) return null
  return avatarSelectionByMessageId.value.get(messageId) ?? null
}

function getAvatarPayloadOrFail(messageId: string | undefined): AvatarSelectionPayload {
  if (!messageId) throw new Error('messageId is required')
  return avatarSelectionByMessageId.value.get(messageId)!
}

function getVoicePayload(messageId: string | undefined): VoiceSelectionPayload | null {
  if (!messageId) return null
  return voiceSelectionByMessageId.value.get(messageId) ?? null
}

function getVoicePayloadOrFail(messageId: string | undefined): VoiceSelectionPayload {
  if (!messageId) throw new Error('messageId is required')
  return voiceSelectionByMessageId.value.get(messageId)!
}

function getReportPayload(msg: unknown): ReportCardPayload | null {
  return extractReportFromMessage(msg) ?? null
}

function getReportPayloadOrFail(msg: unknown): ReportCardPayload {
  return extractReportFromMessage(msg)!
}

const handleUiSelection = (value: string) => {
  const choice = (value || '').trim()
  if (!choice || status.value === 'streaming') return

  const prefix = choice.split(':')[0] + ':'
  const lines = input.value.split('\n').filter(l => l.trim())

  const existingIndex = lines.findIndex(l => l.startsWith(prefix))
  if (existingIndex !== -1) {
    lines[existingIndex] = choice
  } else {
    lines.push(choice)
  }

  input.value = lines.join('\n')
  nextTick(() => getPromptInputElement(promptRef)?.focus())
}

const hasTriggeredInitialReload = ref(false)
watch(chat, (value) => {
  if (hasTriggeredInitialReload.value) {
    return
  }
  if (!value?.messages?.length) {
    return
  }
  if (value.messages.length === 1) {
    hasTriggeredInitialReload.value = true
    reload()
  }
})

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
const openCanvasType = ref<'email' | 'landing-page' | null>(null)
const { vishingUiByMessageId, processVishingStartedSignal, clearAllVishingPolling } = useVishingPolling({
  chatId,
  messages: () => messages.value,
  buildUrl,
  secureFetch,
  getApiHeaders: () => apiHeaders.value
})

const { deepfakeUiByMessageId, processDeepfakeSignal, clearDeepfakePolling } = useDeepfakePolling({
  chatId,
  messages: () => messages.value,
  buildUrl,
  secureFetch
})

const wrappedHideCanvas = () => {
  openCanvasType.value = null
  hideCanvas()
}

watch(
  () => route.params.id,
  (current, previous) => {
    if (current !== previous) {
      clearAllVishingPolling()
      clearDeepfakePolling()
    }
  }
)

const avatarSelectionByMessageId = computed(() => {
  const result = new Map<string, AvatarSelectionPayload | null>()
  for (const message of messages.value) {
    result.set(message.id, extractAvatarSelectionFromMessage(message))
  }
  return result
})

const voiceSelectionByMessageId = computed(() => {
  const result = new Map<string, VoiceSelectionPayload | null>()
  for (const message of messages.value) {
    result.set(message.id, extractVoiceSelectionFromMessage(message))
  }
  return result
})

const { openCanvasWithUrl, openCanvasWithEmail: originalOpenCanvasWithEmail, openCanvasWithLandingPage: originalOpenCanvasWithLandingPage, checkAndTriggerCanvas, maybeProcessUiSignals, handleDataEvent } = useCanvasTriggers(canvasRef, isCanvasVisible, toggleCanvas, wrappedHideCanvas, messages, route, chat, status)

// Wrap canvas open functions to track canvas type
const openCanvasWithEmail = (email: unknown, messageId: string) => {
  openCanvasType.value = 'email'
  originalOpenCanvasWithEmail(email as string | { template: string, fromAddress?: string, fromName?: string, subject?: string }, messageId)
}

const openCanvasWithLandingPage = (landingPage: unknown, messageId: string) => {
  openCanvasType.value = 'landing-page'
  originalOpenCanvasWithLandingPage(landingPage, messageId)
}

// Compute assistant config with conditional actions based on streaming state
const assistantConfig = computed(() => {
  // Check if the last message is currently streaming
  const lastMessage = messages.value[messages.value.length - 1]
  const isStreaming = status.value === 'streaming'
    && lastMessage?.role === 'assistant'
    && lastMessage?.id !== null
    && lastFinishedMessageId.value !== lastMessage?.id

  return {
    actions: isStreaming
      ? []
      : [
          { label: 'Copy', icon: copied.value ? 'i-lucide-copy-check' : 'i-lucide-copy', onClick: copy },
          { label: 'Canvas', icon: 'i-lucide-canvas', onClick: showInCanvas }
        ]
  }
})

function copy(_e: MouseEvent | null, message: { content?: string }) {
  clipboard.copy(message.content ?? '')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function copyTrainingUrl(message: unknown) {
  const url = extractTrainingUrlFromMessage(message)
  if (url) {
    clipboard.copy(url)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

const showInCanvas = (_e: MouseEvent, message: { id?: string, content?: string }) => {
  showInCanvasUtil(canvasRef, message.content ?? '')
}

onMounted(() => {
  // Close canvas when entering a new chat
  if (isCanvasVisible.value) {
    hideCanvas()
  }

  if (chat.value?.messages.length === 1 && !hasTriggeredInitialReload.value) {
    hasTriggeredInitialReload.value = true
    reload()
  }
})

// Track last processed parts count for data-* event detection
const lastProcessedPartsCount = ref(0)

// UNIFIED WATCHER: Handle both legacy (text-based) and MASTRA V1 (data-*) events
watch(
  () => {
    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant') return null
    return {
      id: last.id,
      partsCount: last.parts?.length || 0,
      // Include text hash to detect text changes even when parts count stays same
      textHash: getAllStreamText(last).length
    }
  },
  (current, previous) => {
    if (!current) return
    if (status.value !== 'streaming') return

    const last = messages.value[messages.value.length - 1]
    if (!last) return

    // Reset counter when message ID changes
    if (current.id !== previous?.id) {
      lastProcessedPartsCount.value = 0
    }

    const parts = (last.parts || []) as Array<{ type?: string, data?: { signal?: string, message?: string, workflowRunId?: string, stepIndex?: number } }>

    // 1️⃣ Process new data-* events (MASTRA V1)
    for (let i = lastProcessedPartsCount.value; i < parts.length; i++) {
      const part = parts[i]
      if (part?.type?.startsWith?.('data-')) {
        handleDataEvent(part)

        // Find the message in chatClient
        const clientMessage = chatClient.messages.find((m: { id?: string }) => m.id === last.id) as { id?: string, role?: string, parts?: unknown[] } | undefined
        if (clientMessage) {
          // 🔧 Ensure data-reasoning events are in parts for parseAIReasoning
          if (part.type === 'data-reasoning' && !clientMessage.parts?.includes(part)) {
            clientMessage.parts = clientMessage.parts || []
            clientMessage.parts.push(part)
          }

          // 🔧 Store UI signals in reactive Map (not on message object)
          if (part.type === 'data-ui-signal' && part.data) {
            const messageId = last.id
            if (!uiSignalsMap.value.has(messageId)) {
              uiSignalsMap.value.set(messageId, [])
            }
            const signals = uiSignalsMap.value.get(messageId) ?? []
            // Avoid duplicates
            const exists = signals.some(
              (s: unknown) => (s as { signal?: string, message?: string }).signal === part.data?.signal && (s as { signal?: string, message?: string }).message === part.data?.message
            )
            if (!exists) {
              signals.push(part.data)
            }
          }

          // 🔧 Store workflow step progress in reactive Map
          if (part.type === 'data-workflow-step' && part.data) {
            const stepData = part.data as import('../../composables/useStreamEvents').WorkflowStepData
            const key = `${stepData.workflowRunId}:${stepData.stepIndex}`
            workflowStepsMap.value.set(key, stepData)
          }

          messagesVersion.value += 1 // Trigger reactivity
        }
      }
    }
    lastProcessedPartsCount.value = parts.length

    // 2️⃣ Also check for legacy UI signals in text (backward compatibility)
    maybeProcessUiSignals(last)
    processVishingStartedSignal(last)
    processDeepfakeSignal(last)
  },
  { deep: true }
)

watch(
  () => messages.value.map((message: { id: string }) => message.id).join(','),
  () => {
    for (const message of messages.value) {
      if (message?.role === 'assistant') {
        processVishingStartedSignal(message)
        processDeepfakeSignal(message)
      }
    }
  },
  { immediate: true }
)

function handleCanvasRefresh(messageId: string, newContent: string) {
  updateUiSignalsFromContent(messageId, newContent)

  // Update chat.value messages
  if (chat.value?.messages) {
    const message = chat.value.messages.find((m: { id: string }) => m.id === messageId) as { id: string, content?: string } | undefined
    if (message) {
      message.content = newContent
    }
  }
  // Update Chat client's internal messages array (critical for regenerate)
  const clientMessage = chatClient.messages.find((m: { id: string }) => m.id === messageId) as { id: string, content?: string } | undefined
  if (clientMessage) {
    clientMessage.content = newContent
  }
}
</script>

<template>
  <div class="chat-page w-full min-w-0">
    <UDashboardPanel
      id="chat"
      class="relative"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <DashboardNavbar>
          <template #right />
        </DashboardNavbar>
      </template>

      <template #body>
        <div class="flex h-[calc(100vh-var(--ui-header-height))] min-h-0 overflow-hidden">
          <!-- Chat Area -->
          <div
            class="flex flex-col transition-all duration-300 overflow-y-auto min-h-0"
            :class="{
              'w-full lg:w-1/4 lg:pr-4 min-w-0': isCanvasVisible,
              'flex-1 w-full min-w-0': !isCanvasVisible
            }"
          >
            <div
              :class="[
                'flex-1 flex flex-col min-h-0',
                !isCanvasVisible && 'w-full max-w-4xl mx-auto'
              ]"
            >
              <UContainer class="flex-1 flex flex-col gap-4 sm:gap-6">
                <UChatMessages
                  :messages="chatMessagesForUi"
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
                      :is-canvas-visible="openCanvasType === 'landing-page'"
                      @open="(landingPage) => openCanvasWithLandingPage(landingPage, message.id)"
                      @toggle="(landingPage) => openCanvasType === 'landing-page' ? wrappedHideCanvas() : openCanvasWithLandingPage(landingPage, message.id)"
                    />

                    <!-- Training URL UI -->
                    <TrainingUrlCard
                      v-if="extractTrainingUrlFromMessage(message)"
                      :url="extractTrainingUrlFromMessage(message) || ''"
                      :is-canvas-visible="isCanvasVisible"
                      @open="openCanvasWithUrl"
                      @toggle="(url) => isCanvasVisible ? wrappedHideCanvas() : openCanvasWithUrl(url)"
                      @copy="() => copyTrainingUrl(message)"
                    />

                    <!-- Phishing Email UI - show all emails -->
                    <template
                      v-for="(emails, ei) in [extractAllPhishingEmailsFromMessage(message)]"
                      :key="ei"
                    >
                      <PhishingEmailCard
                        v-for="(email, index) in emails"
                        :key="`${ei}-${index}`"
                        :email="email"
                        :index="index"
                        :total-count="emails.length"
                        :is-canvas-visible="openCanvasType === 'email'"
                        :is-quishing="email.isQuishing"
                        @open="(email) => openCanvasWithEmail(email, message.id)"
                        @toggle="(email) => openCanvasType === 'email' ? wrappedHideCanvas() : openCanvasWithEmail(email, message.id)"
                      />
                    </template>

                    <!-- Reasoning (shown above content, also during streaming) -->
                    <ReasoningSection :reasoning="message.reasoning" />

                    <!-- Tool Call Cards (AI SDK v5 tool-invocation parts) -->
                    <template v-if="message.parts?.length">
                      <ToolCallCard
                        v-for="(part, partIdx) in getToolInvocationParts(message)"
                        :key="part.toolInvocation?.toolCallId ?? `part-${partIdx}`"
                        :tool-name="part.toolInvocation?.toolName || 'unknown'"
                        :status="part.toolInvocation?.state === 'result'
                          ? 'completed'
                          : part.toolInvocation?.state === 'call'
                            ? 'running'
                            : 'pending'"
                        :args="getToolArgs(part)"
                        :result="part.toolInvocation?.state === 'result' ? part.toolInvocation?.result : undefined"
                      />
                    </template>

                    <!-- Workflow Step Progress (visible during and after streaming until next prompt) -->
                    <WorkflowProgress
                      v-if="workflowStepsMap.size > 0
                        && message.role === 'assistant'
                        && message.id === messages[messages.length - 1]?.id"
                      :steps="workflowStepsMap"
                    />

                    <!-- Streaming: show thinking indicator -->
                    <StreamingIndicator
                      :is-streaming="status === 'streaming'
                        && message.role === 'assistant'
                        && message.id === messages[messages.length - 1]?.id
                        && lastFinishedMessageId !== message.id"
                    />

                    <!-- Message text (above Vishing card so "Arama başlatıldı..." appears first) -->
                    <div
                      v-if="!(status === 'streaming'
                        && message.role === 'assistant'
                        && message.id === messages[messages.length - 1]?.id
                        && lastFinishedMessageId !== message.id)"
                      class="whitespace-pre-line"
                    >
                      <MDCCached
                        :value="getSanitizedContentForTemplate(message)"
                        :cache-key="message.id"
                        unwrap="p"
                        :components="components"
                        :parser-options="{ highlight: false }"
                      />
                    </div>

                    <!-- Vishing Call UI (below message text) -->
                    <VishingCallCard
                      v-if="vishingUiByMessageId.get(message.id)?.started || vishingUiByMessageId.get(message.id)?.transcript"
                      :started="vishingUiByMessageId.get(message.id)?.started || null"
                      :transcript="vishingUiByMessageId.get(message.id)?.transcript || null"
                      :summary="vishingUiByMessageId.get(message.id)?.summary || null"
                      @create-next-step="handleCreateVishingNextStep"
                    />

                    <AvatarSelectionCard
                      v-if="getAvatarPayload(message.id)"
                      :payload="getAvatarPayloadOrFail(message.id)"
                      @select="handleUiSelection"
                    />

                    <VoiceSelectionCard
                      v-if="getVoicePayload(message.id)"
                      :payload="getVoicePayloadOrFail(message.id)"
                      @select="handleUiSelection"
                    />

                    <!-- Deepfake Video UI (below message text, like Vishing) -->
                    <DeepfakeVideoCard
                      v-if="deepfakeUiByMessageId.get(message.id)"
                      :video-id="deepfakeUiByMessageId.get(message.id)?.videoId || ''"
                      :status="deepfakeUiByMessageId.get(message.id)?.status || 'processing'"
                      :video-url="deepfakeUiByMessageId.get(message.id)?.videoUrl || null"
                      :video-url-caption="deepfakeUiByMessageId.get(message.id)?.videoUrlCaption || null"
                      :thumbnail-url="deepfakeUiByMessageId.get(message.id)?.thumbnailUrl || null"
                      :duration-sec="deepfakeUiByMessageId.get(message.id)?.durationSec || null"
                      :error-message="deepfakeUiByMessageId.get(message.id)?.errorMessage || null"
                    />

                    <!-- Report UI -->
                    <ReportCard
                      v-if="getReportPayload(message)"
                      :report="getReportPayloadOrFail(message)"
                      @view="handleViewReport"
                      @print="handlePrintReport"
                    />
                  </template>
                </UChatMessages>

                <div
                  ref="promptContainerRef"
                  class="relative sticky bottom-2 z-10 [view-transition-name:chat-prompt] bg-white dark:bg-gray-900"
                  @keydown.capture="handlePromptKeydown"
                  @keyup="syncCursorIndex"
                  @click="syncCursorIndex"
                  @input="syncCursorIndex"
                >
                  <UChatPrompt
                    ref="promptRef"
                    v-model="input"
                    :error="error"
                    :disabled="status === 'streaming' || status === 'submitted'"
                    placeholder="Type your message here, or use @ to mention someone"
                    variant="subtle"
                    autocomplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    :class="[
                      'chat-prompt-custom relative z-20',
                      input.length === 0 ? 'force-default-height' : ''
                    ]"
                    @submit="handlePromptSubmit"
                  >
                    <UChatPromptSubmit
                      :status="promptStatus"
                      color="info"
                      :ui="{
                        base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
                      }"
                      @stop="stop"
                      @reload="reload"
                    />
                  </UChatPrompt>

                  <MentionDropdown
                    ref="mentionDropdownRef"
                    :open="mentionOpen"
                    :loading="mentionLoading"
                    :results="mentionResults"
                    :active-index="mentionIndex"
                    :get-initials="getMentionInitials"
                    @select="handleMentionMouseDown"
                  />
                </div>
              </UContainer>
            </div>
          </div>

          <!-- Canvas Area -->
          <div
            v-if="isCanvasVisible"
            class="w-full lg:w-3/4 min-w-0 border-l border-gray-200 dark:border-gray-800 transition-all duration-300 sticky top-(--ui-header-height) self-start h-[calc(100vh-var(--ui-header-height))] min-h-0 overflow-hidden flex flex-col relative"
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

    <!-- Report Viewer Modal -->
    <ReportViewer
      v-if="showReportViewer && activeReport"
      :report="activeReport.report"
      :report-id="activeReport.reportId"
      :version="activeReport.version"
      @close="showReportViewer = false"
      @print="handlePrintReport()"
    />

    <!-- Report Print View (PDF export) -->
    <ReportPrintView
      v-if="showReportPrint && activeReport"
      :report="activeReport.report"
      :report-id="activeReport.reportId"
      @close="showReportPrint = false"
    />
  </div>
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

/* 3 nokta indicator rengi - bg-elevated yerine primary */
.chat-page :deep(.h-6.flex.items-center.gap-1.py-3 > span) {
  background-color: var(--ui-primary) !important;
}

/* Assistant mesaj content: WorkflowProgress/Reasoning tam genişlik kaplasın (reasoning açılmadan da) */
.chat-page :deep([data-role="assistant"]) {
  width: 100%;
  max-width: 100%;
}
.chat-page :deep([data-role="assistant"] .min-w-0) {
  width: 100%;
  min-width: 0;
  flex: 1 1 0;
}
</style>
