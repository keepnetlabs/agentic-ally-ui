// @ts-nocheck
import { ref, computed } from 'vue'
import {
  extractVishingCallStartedFromMessage,
  extractVishingCallTranscriptFromMessage,
  type VishingCallStartedPayload,
  type VishingCallTranscriptPayload,
  type VishingConversationSummaryPayload
} from '../utils/message-utils'

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

type VishingConversationSummaryResponse = {
  success?: boolean
  summary?: VishingConversationSummaryPayload['summary']
  nextSteps?: VishingConversationSummaryPayload['nextSteps']
  statusCard?: VishingConversationSummaryPayload['statusCard']
}

interface UseVishingPollingOptions {
  chatId: string
  messages: () => any[]
  buildUrl: (path: string) => string
  secureFetch: <T>(url: string, opts?: any) => Promise<T>
  getApiHeaders: () => Record<string, string>
  pollIntervalMs?: number
  pollTimeoutMs?: number
  statusFetchTimeoutMs?: number
  maxConsecutiveFailures?: number
}

export function useVishingPolling(options: UseVishingPollingOptions) {
  const {
    chatId,
    messages,
    buildUrl,
    secureFetch,
    getApiHeaders,
    pollIntervalMs = 3000,
    pollTimeoutMs = 600000,
    statusFetchTimeoutMs = 35000,
    maxConsecutiveFailures = 3
  } = options

  // Polling state
  const pollingTimers = new Map<string, ReturnType<typeof setInterval>>()
  const pollingStartedAt = new Map<string, number>()
  const pollingInFlight = new Set<string>()
  const pollFailCount = new Map<string, number>()

  // Summary state
  const summaryRequested = new Set<string>()
  const summaryAttempted = new Set<string>()
  const summaryInFlight = new Set<string>()

  // Reactive data
  const conversationByMessageId = ref<Map<string, string>>(new Map())
  const transcriptByConversationId = ref<Map<string, VishingCallTranscriptPayload>>(new Map())
  const summaryByConversationId = ref<Map<string, VishingConversationSummaryPayload>>(new Map())

  // Helpers
  const setConversationForMessage = (messageId: string, conversationId: string) => {
    const next = new Map(conversationByMessageId.value)
    next.set(messageId, conversationId)
    conversationByMessageId.value = next
  }

  const setTranscriptForConversation = (conversationId: string, payload: VishingCallTranscriptPayload) => {
    const next = new Map(transcriptByConversationId.value)
    next.set(conversationId, payload)
    transcriptByConversationId.value = next
  }

  const setSummaryForConversation = (conversationId: string, payload: VishingConversationSummaryPayload) => {
    const next = new Map(summaryByConversationId.value)
    next.set(conversationId, payload)
    summaryByConversationId.value = next
  }

  const isTerminalStatus = (status?: string) => {
    const normalized = (status || '').toLowerCase()
    return normalized === 'done' || normalized === 'failed' || normalized === 'timeout'
  }

  const normalizeResponse = (
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

  const stopPolling = (conversationId: string) => {
    console.log('[vishing-ui] stop polling', { chatId, conversationId })
    const timer = pollingTimers.get(conversationId)
    if (timer) {
      clearInterval(timer)
      pollingTimers.delete(conversationId)
    }
    pollingStartedAt.delete(conversationId)
    pollingInFlight.delete(conversationId)
    pollFailCount.delete(conversationId)
  }

  const requestSummary = async (conversationId: string, payload: VishingCallTranscriptPayload) => {
    if (
      !conversationId
      || summaryRequested.has(conversationId)
      || summaryAttempted.has(conversationId)
      || summaryInFlight.has(conversationId)
    ) return
    if (!isTerminalStatus(payload.status)) return
    if (!payload.transcript?.length) return

    summaryAttempted.add(conversationId)
    summaryInFlight.add(conversationId)
    const headers = getApiHeaders()
    const summaryBody = {
      accessToken: headers['X-AGENTIC-ALLY-TOKEN'] || undefined,
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
        headers
      })

      const normalized: VishingConversationSummaryPayload = {
        summary: response?.summary,
        nextSteps: response?.nextSteps || [],
        statusCard: response?.statusCard
      }

      setSummaryForConversation(conversationId, normalized)
      summaryRequested.add(conversationId)
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
      summaryInFlight.delete(conversationId)
    }
  }

  const pollConversation = async (conversationId: string) => {
    if (!conversationId || pollingInFlight.has(conversationId)) {
      if (!conversationId) {
        console.warn('[vishing-ui] poll skipped: missing conversationId')
      }
      return
    }

    const existing = transcriptByConversationId.value.get(conversationId)
    if (existing && isTerminalStatus(existing.status)) {
      console.log('[vishing-ui] poll skipped: terminal state', {
        chatId,
        conversationId,
        status: existing.status
      })
      stopPolling(conversationId)
      return
    }

    const startedAt = pollingStartedAt.get(conversationId) || Date.now()
    if (!pollingStartedAt.has(conversationId)) {
      pollingStartedAt.set(conversationId, startedAt)
    }
    if (Date.now() - startedAt >= pollTimeoutMs) {
      console.warn('[vishing-ui] poll timeout reached', {
        chatId,
        conversationId,
        timeoutMs: pollTimeoutMs
      })
      setTranscriptForConversation(conversationId, {
        conversationId,
        status: 'timeout',
        callDurationSecs: existing?.callDurationSecs || 0,
        hasAudio: existing?.hasAudio,
        recordingUrl: existing?.recordingUrl,
        transcript: existing?.transcript || []
      })
      stopPolling(conversationId)
      return
    }

    pollingInFlight.add(conversationId)
    try {
      const statusUrlBase = buildUrl(`/api/vishing/status/${encodeURIComponent(conversationId)}`)
      const separator = statusUrlBase.includes('?') ? '&' : '?'
      const statusUrl = `${statusUrlBase}${separator}chatId=${encodeURIComponent(chatId)}&_t=${Date.now()}`
      console.log('[vishing-ui] poll request', { chatId, conversationId, statusUrl })
      const response = await secureFetch<VishingStatusResponse>(statusUrl, {
        timeout: statusFetchTimeoutMs
      })
      pollFailCount.set(conversationId, 0)
      const normalized = normalizeResponse(conversationId, response)
      console.log('[vishing-ui] poll response', {
        chatId,
        conversationId,
        status: normalized.status,
        hasAudio: normalized.hasAudio,
        hasRecordingUrl: Boolean(normalized.recordingUrl),
        transcriptLength: normalized.transcript.length,
        callDurationSecs: normalized.callDurationSecs
      })
      setTranscriptForConversation(conversationId, normalized)
      requestSummary(conversationId, normalized)
      const previousLength = existing?.transcript?.length || 0
      if (!isTerminalStatus(normalized.status) && normalized.transcript.length > previousLength) {
        setTimeout(() => {
          pollConversation(conversationId)
        }, 250)
      }
      if (isTerminalStatus(normalized.status)) {
        stopPolling(conversationId)
      }
    } catch (error) {
      const statusCode = (error as any)?.statusCode || (error as any)?.response?.status
      const failCount = (pollFailCount.get(conversationId) || 0) + 1
      pollFailCount.set(conversationId, failCount)

      const isTerminalHttpError = statusCode === 400 || statusCode === 403 || statusCode === 404 ||
        (statusCode != null && statusCode >= 500)
      const tooManyFailures = failCount >= maxConsecutiveFailures

      if (isTerminalHttpError || tooManyFailures) {
        const failureStatus = statusCode === 504 ? 'timeout' : 'failed'
        setTranscriptForConversation(conversationId, {
          conversationId,
          status: failureStatus,
          callDurationSecs: existing?.callDurationSecs || 0,
          hasAudio: existing?.hasAudio,
          recordingUrl: existing?.recordingUrl,
          transcript: existing?.transcript || []
        })
        console.warn('[vishing-ui] poll failed, marking as terminal', {
          chatId,
          conversationId,
          statusCode,
          failCount,
          reason: isTerminalHttpError ? 'http-error' : 'consecutive-failures'
        })
        stopPolling(conversationId)
        return
      }
      console.error('[vishing-ui] poll error', { chatId, conversationId, error, failCount })
    } finally {
      pollingInFlight.delete(conversationId)
    }
  }

  const startPolling = (conversationId: string) => {
    if (!conversationId) {
      console.warn('[vishing-ui] start polling skipped: missing conversationId')
      return
    }
    if (pollingTimers.has(conversationId)) {
      console.log('[vishing-ui] start polling skipped: already active', { chatId, conversationId })
      return
    }

    console.log('[vishing-ui] start polling', {
      chatId,
      conversationId,
      intervalMs: pollIntervalMs,
      timeoutMs: pollTimeoutMs
    })
    pollingStartedAt.set(conversationId, Date.now())
    pollConversation(conversationId)

    const timer = setInterval(() => {
      pollConversation(conversationId)
    }, pollIntervalMs)
    pollingTimers.set(conversationId, timer)
  }

  const processSignal = (message: any) => {
    if (!message?.id) return

    const started = extractVishingCallStartedFromMessage(message)
    if (!started?.conversationId) return
    console.log('[vishing-ui] signal detected', {
      chatId,
      messageId: message.id,
      conversationId: started.conversationId,
      status: started.status
    })

    setConversationForMessage(message.id, started.conversationId)

    const transcriptFromMessage = extractVishingCallTranscriptFromMessage(message)
    if (transcriptFromMessage?.conversationId) {
      console.log('[vishing-ui] transcript signal detected', {
        chatId,
        messageId: message.id,
        conversationId: transcriptFromMessage.conversationId,
        status: transcriptFromMessage.status,
        transcriptLength: transcriptFromMessage.transcript?.length || 0
      })
      setTranscriptForConversation(transcriptFromMessage.conversationId, transcriptFromMessage)
      requestSummary(transcriptFromMessage.conversationId, transcriptFromMessage)
      if (isTerminalStatus(transcriptFromMessage.status)) {
        stopPolling(transcriptFromMessage.conversationId)
        return
      }
    }

    if (!transcriptByConversationId.value.has(started.conversationId)) {
      setTranscriptForConversation(started.conversationId, {
        conversationId: started.conversationId,
        status: started.status || 'ringing',
        callDurationSecs: 0,
        hasAudio: false,
        transcript: []
      })
    }

    startPolling(started.conversationId)
  }

  const uiByMessageId = computed(() => {
    const result = new Map<string, { started: VishingCallStartedPayload | null; transcript: VishingCallTranscriptPayload | null; summary: VishingConversationSummaryPayload | null }>()

    for (const message of messages()) {
      const startedFromMessage = extractVishingCallStartedFromMessage(message)
      const transcriptFromMessage = extractVishingCallTranscriptFromMessage(message)
      const mappedConversationId = conversationByMessageId.value.get(message.id)
      const conversationId = startedFromMessage?.conversationId || transcriptFromMessage?.conversationId || mappedConversationId || ''
      const polledTranscript = conversationId ? transcriptByConversationId.value.get(conversationId) || null : null
      const summary = conversationId ? summaryByConversationId.value.get(conversationId) || null : null

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

  const clearAll = () => {
    for (const timer of pollingTimers.values()) {
      clearInterval(timer)
    }
    pollingTimers.clear()
    pollingStartedAt.clear()
    pollingInFlight.clear()
    pollFailCount.clear()
    summaryRequested.clear()
    summaryAttempted.clear()
    summaryInFlight.clear()
    conversationByMessageId.value = new Map()
    transcriptByConversationId.value = new Map()
    summaryByConversationId.value = new Map()
  }

  return {
    vishingUiByMessageId: uiByMessageId,
    processVishingStartedSignal: processSignal,
    clearAllVishingPolling: clearAll
  }
}
