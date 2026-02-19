<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFetch, createError, refreshNuxtData } from 'nuxt/app'
// @ts-ignore - Nuxt auto-imports are typed via generated #imports during dev
import { useToast } from '#imports'
import { useLLM } from '../../composables/useLLM'
import { useCanvas } from '../../composables/useCanvas'
import { useCanvasTriggers } from '../../composables/useCanvasTriggers'
import { useChatClient } from '../../composables/useChatClient'
import { useRouteParams } from '../../composables/useRouteParams'
import { useAuthToken } from '../../composables/useAuthToken'
import { useSecureApi } from '../../composables/useSecureApi'
import { parseError } from '../../utils/error-handler'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useClipboard } from '@vueuse/core'
import { parseAIMessage, parseAIReasoning } from '../../utils/text-utils'
import {
  extractTrainingUrlFromMessage,
  extractAllPhishingEmailsFromMessage,
  extractLandingPageFromMessage,
  extractVishingCallStartedFromMessage,
  extractVishingCallTranscriptFromMessage,
  extractDeepfakeVideoGeneratingFromMessage,
  type VishingCallStartedPayload,
  type VishingCallTranscriptPayload,
  type VishingNextStepItem,
  type VishingConversationSummaryPayload,
  type DeepfakeVideoGeneratingPayload,
  getSanitizedContentForTemplate,
  getAllStreamText,
  showInCanvas as showInCanvasUtil
} from '../../utils/message-utils'
import { useMentions } from '../../composables/useMentions'
import { useExternalPrompt } from '../../composables/useExternalPrompt'
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
const { buildUrl, companyId, baseApiUrl, sessionId } = useRouteParams()
const { token: accessToken, clearToken } = useAuthToken()
const { secureFetch } = useSecureApi()

const chatId = String(route.params.id)

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
      headers: {
        ...(accessToken.value ? { 'X-AGENTIC-ALLY-TOKEN': accessToken.value } : {}),
        ...(companyId.value ? { 'X-COMPANY-ID': companyId.value } : {}),
        ...(baseApiUrl.value ? { 'X-BASE-API-URL': baseApiUrl.value } : {})
      }
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
    if (!isComponentActive.value) {
      return false
    }
    return saveMessageWithRetry(messageId, content, attempt + 1, startTime, config)
  }
}

const chatHeaders = computed(() => ({
  ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {})
}))

// @ts-ignore - Nuxt allows top-level await in script setup
const { data: chat, refresh: refreshChat } = await useFetch<ServerChat>(chatUrl, {
  key: `chat-${chatId}`,
  immediate: false,
  lazy: true,
  credentials: 'include',  // Allow cookies in cross-origin requests
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

useExternalPrompt({ input, promptRef })

const streamUrl = buildUrl(`/api/chats/${chatId}`)

const chatClient = new Chat({
  id: chatId,
  transport: new DefaultChatTransport({
    api: streamUrl,
    body: { ...getModelConfig(model.value), conversationId: chatId },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}),
          ...(accessToken.value ? { 'X-AGENTIC-ALLY-TOKEN': accessToken.value } : {}),
          ...(companyId.value ? { 'X-COMPANY-ID': companyId.value } : {}),
          ...(baseApiUrl.value ? { 'X-BASE-API-URL': baseApiUrl.value } : {})
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

const messagesVersion = ref(0)
// MASTRA V1: Store UI signals separately (reactive Map by message ID)
const uiSignalsMap = ref<Map<string, any[]>>(new Map())

const baseMessages = createMessages(chatClient, parseAIReasoning, parseAIMessage, messagesVersion)

// MASTRA V1: Wrap messages to include uiSignals from reactive Map
const messages = computed(() => {
  // Access Map to make this computed reactive to Map changes
  const signalsMap = uiSignalsMap.value
  return baseMessages.value.map((m: any) => ({
    ...m,
    uiSignals: signalsMap.get(m.id) || []
  }))
})
watch(chat, (value) => {
  if (!value?.messages?.length) {
    return
  }
  chatClient.messages = value.messages.map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    parts: m.parts ?? []
  }))
  messagesVersion.value += 1
})
const status = createStatus(chatClient)
const error = createErrorComputed(chatClient)
const lastFinishedMessageId = ref<string | null>(null)
const promptStatus = computed(() => (error.value ? 'error' : status.value))

const handleSubmit = createHandleSubmit(chatClient, input, messages, status, lastFinishedMessageId)

const stop = createStop()
onBeforeUnmount(() => {
  isComponentActive.value = false
  stop()
  clearAllVishingPolling()
  for (const timer of deepfakePollingTimers.values()) clearInterval(timer)
  deepfakePollingTimers.clear()
})
const reload = createReload(chatClient)

const handlePromptSubmit = () => {
  closeMentionMenu()
  applyTargetTags()
  handleSubmit()
  clearSelectedTargets()
}

const handleCreateVishingNextStep = (nextStep: VishingNextStepItem) => {
  input.value = nextStep.prompt || `Create training about ${nextStep.title}`
  promptRef.value?.focus?.()
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
const VISHING_POLL_INTERVAL_MS = 1000
const VISHING_POLL_TIMEOUT_MS = 600000

const DEEPFAKE_POLL_INTERVAL_MS  = 10_000   // 10 saniye — render 1-2dk sürer
const DEEPFAKE_POLL_TIMEOUT_MS   = 300_000  // 5 dakika max

const deepfakePollingTimers      = new Map<string, ReturnType<typeof setInterval>>()
const deepfakePollingStartedAt   = new Map<string, number>()
const deepfakePollingInFlight    = new Set<string>()
const deepfakeStatusByVideoId    = ref<Map<string, {
  videoId: string
  status: string
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSec: number | null
}>>(new Map())

const vishingPollingTimers = new Map<string, ReturnType<typeof setInterval>>()
const vishingPollingStartedAt = new Map<string, number>()
const vishingPollingInFlight = new Set<string>()
const vishingSummaryRequested = new Set<string>()
const vishingSummaryAttempted = new Set<string>()
const vishingSummaryInFlight = new Set<string>()
const vishingConversationByMessageId = ref<Map<string, string>>(new Map())
const vishingTranscriptByConversationId = ref<Map<string, VishingCallTranscriptPayload>>(new Map())
const vishingSummaryByConversationId = ref<Map<string, VishingConversationSummaryPayload>>(new Map())

const clearAllVishingPolling = () => {
  for (const timer of vishingPollingTimers.values()) {
    clearInterval(timer)
  }
  vishingPollingTimers.clear()
  vishingPollingStartedAt.clear()
  vishingPollingInFlight.clear()
  vishingSummaryRequested.clear()
  vishingSummaryAttempted.clear()
  vishingSummaryInFlight.clear()
}

type VishingStatusResponse = {
  conversationId: string
  status: string
  callDurationSecs: number
  hasAudio?: boolean
  has_audio?: boolean
  recordingUrl?: string
  recording_url?: string
  audioUrl?: string
  audio_url?: string
  metadata?: {
    hasAudio?: boolean
    has_audio?: boolean
    recordingUrl?: string
    recording_url?: string
    audioUrl?: string
    audio_url?: string
  }
  transcript: Array<{
    role: 'agent' | 'user'
    message: string
    timestamp: number
  }>
}

const wrappedHideCanvas = () => {
  openCanvasType.value = null
  hideCanvas()
}

const setVishingConversationForMessage = (messageId: string, conversationId: string) => {
  const next = new Map(vishingConversationByMessageId.value)
  next.set(messageId, conversationId)
  vishingConversationByMessageId.value = next
}

const setVishingTranscriptForConversation = (conversationId: string, payload: VishingCallTranscriptPayload) => {
  const next = new Map(vishingTranscriptByConversationId.value)
  next.set(conversationId, payload)
  vishingTranscriptByConversationId.value = next
}

const setVishingSummaryForConversation = (conversationId: string, payload: VishingConversationSummaryPayload) => {
  const next = new Map(vishingSummaryByConversationId.value)
  next.set(conversationId, payload)
  vishingSummaryByConversationId.value = next
}

const isTerminalVishingStatus = (status?: string) => {
  const normalized = (status || '').toLowerCase()
  return normalized === 'done' || normalized === 'failed' || normalized === 'timeout'
}

const normalizeVishingResponse = (
  conversationId: string,
  response: Partial<VishingStatusResponse>
): VishingCallTranscriptPayload => {
  const hasAudio = response.hasAudio
    ?? response.has_audio
    ?? response.metadata?.hasAudio
    ?? response.metadata?.has_audio
    ?? false

  const recordingUrl = response.recordingUrl
    || response.recording_url
    || response.audioUrl
    || response.audio_url
    || response.metadata?.recordingUrl
    || response.metadata?.recording_url
    || response.metadata?.audioUrl
    || response.metadata?.audio_url
    || undefined

  const transcript: VishingCallTranscriptPayload['transcript'] = Array.isArray(response.transcript)
    ? response.transcript.map((item) => {
      const role: 'agent' | 'user' = item.role === 'agent' ? 'agent' : 'user'
      return {
        role,
        message: item.message || '',
        timestamp: Number(item.timestamp || 0)
      }
    })
    : []

  return {
    conversationId,
    status: response.status || 'initiated',
    callDurationSecs: Number(response.callDurationSecs || 0),
    hasAudio: Boolean(hasAudio),
    recordingUrl: typeof recordingUrl === 'string' && recordingUrl.length > 0 ? recordingUrl : undefined,
    transcript
  }
}

const stopVishingPolling = (conversationId: string) => {
  console.log('[vishing-ui] stop polling', { chatId, conversationId })
  const timer = vishingPollingTimers.get(conversationId)
  if (timer) {
    clearInterval(timer)
    vishingPollingTimers.delete(conversationId)
  }
  vishingPollingStartedAt.delete(conversationId)
  vishingPollingInFlight.delete(conversationId)
}

type VishingConversationSummaryResponse = {
  success?: boolean
  summary?: VishingConversationSummaryPayload['summary']
  nextSteps?: VishingConversationSummaryPayload['nextSteps']
  statusCard?: VishingConversationSummaryPayload['statusCard']
}

const requestVishingSummary = async (conversationId: string, payload: VishingCallTranscriptPayload) => {
  if (
    !conversationId
    || vishingSummaryRequested.has(conversationId)
    || vishingSummaryAttempted.has(conversationId)
    || vishingSummaryInFlight.has(conversationId)
  ) return
  if (!isTerminalVishingStatus(payload.status)) return
  if (!payload.transcript?.length) return

  vishingSummaryAttempted.add(conversationId)
  vishingSummaryInFlight.add(conversationId)
  const summaryBody = {
    accessToken: accessToken.value || undefined,
    conversationId,
    messages: payload.transcript.map((item) => ({
      role: item.role,
      text: item.message,
      timestamp: item.timestamp
    }))
  }

  try {
    const summaryUrl = buildUrl('/api/vishing/conversations/summary')
    console.log('[vishing-summary] request', { chatId, conversationId, summaryUrl, messageCount: summaryBody.messages.length })
    const response = await secureFetch<VishingConversationSummaryResponse>(summaryUrl, {
      method: 'POST',
      body: summaryBody,
      headers: {
        ...(accessToken.value ? { 'X-AGENTIC-ALLY-TOKEN': accessToken.value } : {}),
        ...(companyId.value ? { 'X-COMPANY-ID': companyId.value } : {}),
        ...(baseApiUrl.value ? { 'X-BASE-API-URL': baseApiUrl.value } : {})
      }
    })

    const normalized: VishingConversationSummaryPayload = {
      summary: response?.summary,
      nextSteps: response?.nextSteps || [],
      statusCard: response?.statusCard
    }

    setVishingSummaryForConversation(conversationId, normalized)
    vishingSummaryRequested.add(conversationId)
    console.log('[vishing-summary] response', {
      chatId,
      conversationId,
      success: response?.success,
      hasStatusCard: Boolean(response?.statusCard),
      timelineLength: response?.summary?.timeline?.length || 0,
      nextStepsLength: response?.nextSteps?.length || 0
    })
  } catch (error) {
    console.error('[vishing-summary] request failed', { chatId, conversationId, error })
  } finally {
    vishingSummaryInFlight.delete(conversationId)
  }
}

const pollVishingConversation = async (conversationId: string) => {
  if (!conversationId || vishingPollingInFlight.has(conversationId)) {
    if (!conversationId) {
      console.warn('[vishing-ui] poll skipped: missing conversationId')
    }
    return
  }

  const existing = vishingTranscriptByConversationId.value.get(conversationId)
  if (existing && isTerminalVishingStatus(existing.status)) {
    console.log('[vishing-ui] poll skipped: terminal state', {
      chatId,
      conversationId,
      status: existing.status
    })
    stopVishingPolling(conversationId)
    return
  }

  const startedAt = vishingPollingStartedAt.get(conversationId) || Date.now()
  if (!vishingPollingStartedAt.has(conversationId)) {
    vishingPollingStartedAt.set(conversationId, startedAt)
  }
  if (Date.now() - startedAt >= VISHING_POLL_TIMEOUT_MS) {
    console.warn('[vishing-ui] poll timeout reached', {
      chatId,
      conversationId,
      timeoutMs: VISHING_POLL_TIMEOUT_MS
    })
    setVishingTranscriptForConversation(conversationId, {
      conversationId,
      status: 'timeout',
      callDurationSecs: existing?.callDurationSecs || 0,
      hasAudio: existing?.hasAudio,
      recordingUrl: existing?.recordingUrl,
      transcript: existing?.transcript || []
    })
    stopVishingPolling(conversationId)
    return
  }

  vishingPollingInFlight.add(conversationId)
  try {
    const statusUrlBase = buildUrl(`/api/vishing/status/${encodeURIComponent(conversationId)}`)
    const separator = statusUrlBase.includes('?') ? '&' : '?'
    const statusUrl = `${statusUrlBase}${separator}chatId=${encodeURIComponent(chatId)}&_t=${Date.now()}`
    console.log('[vishing-ui] poll request', { chatId, conversationId, statusUrl })
    const response = await secureFetch<VishingStatusResponse>(statusUrl)
    const normalized = normalizeVishingResponse(conversationId, response)
    console.log('[vishing-ui] poll response', {
      chatId,
      conversationId,
      status: normalized.status,
      hasAudio: normalized.hasAudio,
      hasRecordingUrl: Boolean(normalized.recordingUrl),
      transcriptLength: normalized.transcript.length,
      callDurationSecs: normalized.callDurationSecs
    })
    setVishingTranscriptForConversation(conversationId, normalized)
    requestVishingSummary(conversationId, normalized)
    const previousLength = existing?.transcript?.length || 0
    if (!isTerminalVishingStatus(normalized.status) && normalized.transcript.length > previousLength) {
      // Pull once more quickly after new live transcript chunks for snappier UI.
      setTimeout(() => {
        pollVishingConversation(conversationId)
      }, 250)
    }
    if (isTerminalVishingStatus(normalized.status)) {
      stopVishingPolling(conversationId)
    }
  } catch (error) {
    const statusCode = (error as any)?.statusCode || (error as any)?.response?.status
    if (statusCode === 400 || statusCode === 403 || statusCode === 404) {
      setVishingTranscriptForConversation(conversationId, {
        conversationId,
        status: 'failed',
        callDurationSecs: existing?.callDurationSecs || 0,
        hasAudio: existing?.hasAudio,
        recordingUrl: existing?.recordingUrl,
        transcript: existing?.transcript || []
      })
      console.warn('[vishing-ui] poll failed with terminal status code', {
        chatId,
        conversationId,
        statusCode
      })
      stopVishingPolling(conversationId)
      return
    }
    console.error('[vishing-ui] poll error', { chatId, conversationId, error })
  } finally {
    vishingPollingInFlight.delete(conversationId)
  }
}

const startVishingPolling = (conversationId: string) => {
  if (!conversationId) {
    console.warn('[vishing-ui] start polling skipped: missing conversationId')
    return
  }
  if (vishingPollingTimers.has(conversationId)) {
    console.log('[vishing-ui] start polling skipped: already active', { chatId, conversationId })
    return
  }

  console.log('[vishing-ui] start polling', {
    chatId,
    conversationId,
    intervalMs: VISHING_POLL_INTERVAL_MS,
    timeoutMs: VISHING_POLL_TIMEOUT_MS
  })
  vishingPollingStartedAt.set(conversationId, Date.now())
  pollVishingConversation(conversationId)

  const timer = setInterval(() => {
    pollVishingConversation(conversationId)
  }, VISHING_POLL_INTERVAL_MS)
  vishingPollingTimers.set(conversationId, timer)
}

const processVishingStartedSignal = (message: any) => {
  if (!message?.id) return

  const started = extractVishingCallStartedFromMessage(message)
  if (!started?.conversationId) return
  console.log('[vishing-ui] signal detected', {
    chatId,
    messageId: message.id,
    conversationId: started.conversationId,
    status: started.status
  })

  setVishingConversationForMessage(message.id, started.conversationId)

  const transcriptFromMessage = extractVishingCallTranscriptFromMessage(message)
  if (transcriptFromMessage?.conversationId) {
    console.log('[vishing-ui] transcript signal detected', {
      chatId,
      messageId: message.id,
      conversationId: transcriptFromMessage.conversationId,
      status: transcriptFromMessage.status,
      transcriptLength: transcriptFromMessage.transcript?.length || 0
    })
    setVishingTranscriptForConversation(transcriptFromMessage.conversationId, transcriptFromMessage)
    requestVishingSummary(transcriptFromMessage.conversationId, transcriptFromMessage)
    if (isTerminalVishingStatus(transcriptFromMessage.status)) {
      stopVishingPolling(transcriptFromMessage.conversationId)
      return
    }
  }

  if (!vishingTranscriptByConversationId.value.has(started.conversationId)) {
    setVishingTranscriptForConversation(started.conversationId, {
      conversationId: started.conversationId,
      status: started.status || 'ringing',
      callDurationSecs: 0,
      hasAudio: false,
      transcript: []
    })
  }

  startVishingPolling(started.conversationId)
}

const vishingUiByMessageId = computed(() => {
  const result = new Map<string, { started: VishingCallStartedPayload | null; transcript: VishingCallTranscriptPayload | null; summary: VishingConversationSummaryPayload | null }>()

  for (const message of messages.value) {
    const startedFromMessage = extractVishingCallStartedFromMessage(message)
    const transcriptFromMessage = extractVishingCallTranscriptFromMessage(message)
    const mappedConversationId = vishingConversationByMessageId.value.get(message.id)
    const conversationId = startedFromMessage?.conversationId || transcriptFromMessage?.conversationId || mappedConversationId || ''
    const polledTranscript = conversationId ? vishingTranscriptByConversationId.value.get(conversationId) || null : null
    const summary = conversationId ? vishingSummaryByConversationId.value.get(conversationId) || null : null

    const started: VishingCallStartedPayload | null = startedFromMessage || (
      conversationId
        ? {
          conversationId,
          callSid: '',
          status: polledTranscript?.status || 'initiated'
        }
        : null
    )

    const transcript = transcriptFromMessage || polledTranscript
    result.set(message.id, { started, transcript, summary })
  }

  return result
})

watch(
  () => route.params.id,
  (current, previous) => {
    if (current !== previous) {
      console.log('[vishing-ui] route changed, clearing polling state', {
        from: previous,
        to: current
      })
      clearAllVishingPolling()
      vishingConversationByMessageId.value = new Map()
      vishingTranscriptByConversationId.value = new Map()
      vishingSummaryByConversationId.value = new Map()

      // Deepfake polling temizle
      for (const timer of deepfakePollingTimers.values()) clearInterval(timer)
      deepfakePollingTimers.clear()
      deepfakePollingStartedAt.clear()
      deepfakePollingInFlight.clear()
      deepfakeStatusByVideoId.value = new Map()
    }
  }
)

const isTerminalDeepfakeStatus = (status: string) =>
  status === 'completed' || status === 'failed'

const stopDeepfakePolling = (videoId: string) => {
  const timer = deepfakePollingTimers.get(videoId)
  if (timer) clearInterval(timer)
  deepfakePollingTimers.delete(videoId)
  deepfakePollingStartedAt.delete(videoId)
  deepfakePollingInFlight.delete(videoId)
}

const pollDeepfakeStatus = async (videoId: string) => {
  if (deepfakePollingInFlight.has(videoId)) return

  const existing = deepfakeStatusByVideoId.value.get(videoId)
  if (existing && isTerminalDeepfakeStatus(existing.status)) {
    stopDeepfakePolling(videoId)
    return
  }

  const startedAt = deepfakePollingStartedAt.get(videoId) || Date.now()
  if (!deepfakePollingStartedAt.has(videoId)) deepfakePollingStartedAt.set(videoId, startedAt)
  if (Date.now() - startedAt >= DEEPFAKE_POLL_TIMEOUT_MS) {
    console.warn('[deepfake-ui] poll timeout reached', { videoId, timeoutMs: DEEPFAKE_POLL_TIMEOUT_MS })
    const next = new Map(deepfakeStatusByVideoId.value)
    next.set(videoId, { videoId, status: 'failed', videoUrl: null, thumbnailUrl: null, durationSec: null })
    deepfakeStatusByVideoId.value = next
    stopDeepfakePolling(videoId)
    return
  }

  deepfakePollingInFlight.add(videoId)
  try {
    const statusUrlBase = buildUrl(`/api/deepfake/status/${encodeURIComponent(videoId)}`)
    const separator = statusUrlBase.includes('?') ? '&' : '?'
    const statusUrl = `${statusUrlBase}${separator}chatId=${encodeURIComponent(chatId)}`
    console.log('[deepfake-ui] poll request', { videoId, statusUrl })
    const response = await secureFetch<{
      success: boolean
      videoId: string
      status: string
      videoUrl: string | null
      thumbnailUrl: string | null
      durationSec: number | null
    }>(statusUrl)

    console.log('[deepfake-ui] poll response', {
      videoId,
      status: response.status,
      hasVideoUrl: Boolean(response.videoUrl)
    })

    const next = new Map(deepfakeStatusByVideoId.value)
    next.set(videoId, {
      videoId,
      status:       response.status ?? 'processing',
      videoUrl:     response.videoUrl ?? null,
      thumbnailUrl: response.thumbnailUrl ?? null,
      durationSec:  response.durationSec ?? null,
    })
    deepfakeStatusByVideoId.value = next

    if (isTerminalDeepfakeStatus(response.status)) {
      console.log('[deepfake-ui] terminal status reached, stopping poll', { videoId, status: response.status })
      stopDeepfakePolling(videoId)
    }
  } catch (err) {
    console.error('[deepfake-ui] poll error', { videoId, err })
  } finally {
    deepfakePollingInFlight.delete(videoId)
  }
}

const startDeepfakePolling = (videoId: string) => {
  if (!videoId || deepfakePollingTimers.has(videoId)) return

  deepfakePollingStartedAt.set(videoId, Date.now())
  pollDeepfakeStatus(videoId)

  const timer = setInterval(() => pollDeepfakeStatus(videoId), DEEPFAKE_POLL_INTERVAL_MS)
  deepfakePollingTimers.set(videoId, timer)
}

const processDeepfakeSignal = (message: any) => {
  if (!message?.id) return
  const payload = extractDeepfakeVideoGeneratingFromMessage(message)
  if (!payload?.videoId) return

  if (!deepfakeStatusByVideoId.value.has(payload.videoId)) {
    const next = new Map(deepfakeStatusByVideoId.value)
    next.set(payload.videoId, {
      videoId:      payload.videoId,
      status:       'processing',
      videoUrl:     null,
      thumbnailUrl: null,
      durationSec:  null,
    })
    deepfakeStatusByVideoId.value = next
  }

  startDeepfakePolling(payload.videoId)
}

const deepfakeUiByMessageId = computed(() => {
  const result = new Map<string, {
    videoId: string
    status: string
    videoUrl: string | null
    thumbnailUrl: string | null
    durationSec: number | null
  } | null>()

  for (const message of messages.value) {
    const payload = extractDeepfakeVideoGeneratingFromMessage(message)
    if (!payload?.videoId) {
      result.set(message.id, null)
      continue
    }
    const polled = deepfakeStatusByVideoId.value.get(payload.videoId)
    result.set(message.id, polled ?? {
      videoId:      payload.videoId,
      status:       'processing',
      videoUrl:     null,
      thumbnailUrl: null,
      durationSec:  null,
    })
  }

  return result
})

const { openCanvasWithUrl, openCanvasWithEmail: originalOpenCanvasWithEmail, openCanvasWithLandingPage: originalOpenCanvasWithLandingPage, checkAndTriggerCanvas, maybeProcessUiSignals, hasCanvasOpenedForCurrentMessage, hasEmailRenderedForCurrentMessage, handleDataEvent } = useCanvasTriggers(canvasRef, isCanvasVisible, toggleCanvas, wrappedHideCanvas, messages, route, chat, status)

// Wrap canvas open functions to track canvas type
const openCanvasWithEmail = (email: any, messageId: string) => {
  openCanvasType.value = 'email'
  originalOpenCanvasWithEmail(email, messageId)
}

const openCanvasWithLandingPage = (landingPage: any, messageId: string) => {
  openCanvasType.value = 'landing-page'
  originalOpenCanvasWithLandingPage(landingPage, messageId)
}

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

    const parts = last.parts || []

    // 1️⃣ Process new data-* events (MASTRA V1)
    for (let i = lastProcessedPartsCount.value; i < parts.length; i++) {
      const part = parts[i]
      if (part?.type?.startsWith?.('data-')) {
        handleDataEvent(part)

        // Find the message in chatClient
        const clientMessage = chatClient.messages.find((m: any) => m.id === last.id) as any
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
            const signals = uiSignalsMap.value.get(messageId)!
            // Avoid duplicates
            const exists = signals.some(
              (s: any) => s.signal === part.data.signal && s.message === part.data.message
            )
            if (!exists) {
              signals.push(part.data)
            }
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
  () => messages.value.map((message: any) => message.id).join(','),
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
                <PhishingEmailCard
                  v-for="(email, index) in extractAllPhishingEmailsFromMessage(message)"
                  :key="index"
                  :email="email"
                  :index="index"
                  :total-count="extractAllPhishingEmailsFromMessage(message).length"
                  :is-canvas-visible="openCanvasType === 'email'"
                  :is-quishing="email.isQuishing"
                  @open="(email) => openCanvasWithEmail(email, message.id)"
                  @toggle="(email) => openCanvasType === 'email' ? wrappedHideCanvas() : openCanvasWithEmail(email, message.id)"
                />

                <!-- Vishing Call UI -->
                <VishingCallCard
                  v-if="vishingUiByMessageId.get(message.id)?.started || vishingUiByMessageId.get(message.id)?.transcript"
                  :started="vishingUiByMessageId.get(message.id)?.started || null"
                  :transcript="vishingUiByMessageId.get(message.id)?.transcript || null"
                  :summary="vishingUiByMessageId.get(message.id)?.summary || null"
                  @create-next-step="handleCreateVishingNextStep"
                />

                <!-- Deepfake Video UI -->
                <DeepfakeVideoCard
                  v-if="deepfakeUiByMessageId.get(message.id)"
                  :video-id="deepfakeUiByMessageId.get(message.id)?.videoId || ''"
                  :status="deepfakeUiByMessageId.get(message.id)?.status || 'processing'"
                  :video-url="deepfakeUiByMessageId.get(message.id)?.videoUrl || null"
                  :thumbnail-url="deepfakeUiByMessageId.get(message.id)?.thumbnailUrl || null"
                  :duration-sec="deepfakeUiByMessageId.get(message.id)?.durationSec || null"
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

              <div
                v-if="mentionOpen"
                class="absolute left-0 right-0 bottom-full mb-2 z-30 pointer-events-none"
              >
                <div ref="mentionListRef" class="max-h-44 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
                  <div v-if="mentionLoading" class="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    <UIcon name="i-lucide-loader-2" class="h-3.5 w-3.5 animate-spin" />
                    Loading results...
                  </div>
                  <div
                    v-else-if="mentionResults.length === 0"
                    class="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <UIcon name="i-lucide-search-x" class="h-3.5 w-3.5" />
                    No results...
                  </div>
                  <button
                    v-for="(item, index) in mentionResults"
                    :key="`${item.kind}-${item.id}`"
                    type="button"
                    :data-mention-index="index"
                    class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 pointer-events-auto"
                    :class="index === mentionIndex ? 'bg-gray-50 dark:bg-gray-800' : ''"
                    @mousedown.prevent="handleMentionMouseDown(item)"
                  >
                    <div
                      v-if="!item.avatar"
                      class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-100"
                    >
                      {{ getMentionInitials(item) }}
                    </div>
                    <img
                      v-else
                      :src="item.avatar"
                      :alt="item.name"
                      class="h-6 w-6 rounded-full"
                    />
                    <div class="flex flex-col">
                      <span class="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                        {{ item.name }}
                        <span
                          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          :class="item.kind === 'group'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'"
                        >
                          <UIcon :name="item.kind === 'group' ? 'i-lucide-users' : 'i-lucide-user'" class="h-3 w-3" />
                          {{ item.kind === 'group' ? 'Target Group' : 'Target User' }}
                        </span>
                      </span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ item.kind === 'group'
                      ? `${item.memberCount ?? 0} ${((item.memberCount ?? 0) === 1 || (item.memberCount ?? 0) === 0) ? 'member' : 'members'}`
                      : item.email }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
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
