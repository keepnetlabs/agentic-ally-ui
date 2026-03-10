// @ts-nocheck
import { ref, computed } from 'vue'
import {
  extractDeepfakeVideoGeneratingFromMessage,
  type DeepfakeVideoGeneratingPayload
} from '../utils/message-utils'

export interface DeepfakeStatus {
  videoId: string
  status: string
  videoUrl: string | null
  videoUrlCaption: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  errorMessage: string | null
}

interface UseDeepfakePollingOptions {
  chatId: string
  messages: () => any[]
  buildUrl: (path: string) => string
  secureFetch: <T>(url: string, opts?: any) => Promise<T>
  pollIntervalMs?: number
  pollTimeoutMs?: number
}

export function useDeepfakePolling(options: UseDeepfakePollingOptions) {
  const {
    chatId,
    messages,
    buildUrl,
    secureFetch,
    pollIntervalMs = 10_000,
    pollTimeoutMs = 1_200_000
  } = options

  const pollingTimers = new Map<string, ReturnType<typeof setInterval>>()
  const pollingStartedAt = new Map<string, number>()
  const pollingInFlight = new Set<string>()
  const statusByVideoId = ref<Map<string, DeepfakeStatus>>(new Map())

  const isTerminalStatus = (status: string) =>
    status === 'completed' || status === 'failed'

  const setStatus = (videoId: string, data: DeepfakeStatus) => {
    const next = new Map(statusByVideoId.value)
    next.set(videoId, data)
    statusByVideoId.value = next
  }

  const stopPolling = (videoId: string) => {
    const timer = pollingTimers.get(videoId)
    if (timer) clearInterval(timer)
    pollingTimers.delete(videoId)
    pollingStartedAt.delete(videoId)
    pollingInFlight.delete(videoId)
  }

  const pollStatus = async (videoId: string) => {
    if (pollingInFlight.has(videoId)) return

    const existing = statusByVideoId.value.get(videoId)
    if (existing && isTerminalStatus(existing.status)) {
      stopPolling(videoId)
      return
    }

    const startedAt = pollingStartedAt.get(videoId) || Date.now()
    if (!pollingStartedAt.has(videoId)) pollingStartedAt.set(videoId, startedAt)
    if (Date.now() - startedAt >= pollTimeoutMs) {
      console.warn('[deepfake-ui] poll timeout reached', { videoId, timeoutMs: pollTimeoutMs })
      setStatus(videoId, { videoId, status: 'failed', videoUrl: null, videoUrlCaption: null, thumbnailUrl: null, durationSec: null, errorMessage: 'Generation timed out after 20 minutes.' })
      stopPolling(videoId)
      return
    }

    pollingInFlight.add(videoId)
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
        videoUrlCaption: string | null
        thumbnailUrl: string | null
        durationSec: number | null
        error?: string | null
      }>(statusUrl)

      console.log('[deepfake-ui] poll response', {
        videoId,
        status: response.status,
        hasVideoUrl: Boolean(response.videoUrl),
        error: response.error
      })

      setStatus(videoId, {
        videoId,
        status: response.status ?? 'processing',
        videoUrl: response.videoUrl ?? null,
        videoUrlCaption: response.videoUrlCaption ?? null,
        thumbnailUrl: response.thumbnailUrl ?? null,
        durationSec: response.durationSec ?? null,
        errorMessage: response.error ?? null
      })

      if (isTerminalStatus(response.status)) {
        console.log('[deepfake-ui] terminal status reached, stopping poll', { videoId, status: response.status })
        stopPolling(videoId)
      }
    } catch (err: any) {
      console.error('[deepfake-ui] poll error', { videoId, err })
      const errMsg = err?.message || err?.statusMessage || String(err)
      setStatus(videoId, {
        videoId,
        status: 'failed',
        videoUrl: null,
        videoUrlCaption: null,
        thumbnailUrl: null,
        durationSec: null,
        errorMessage: errMsg || 'Failed to fetch video status.'
      })
      stopPolling(videoId)
    } finally {
      pollingInFlight.delete(videoId)
    }
  }

  const startPolling = (videoId: string) => {
    if (!videoId || pollingTimers.has(videoId)) return

    pollingStartedAt.set(videoId, Date.now())
    pollStatus(videoId)

    const timer = setInterval(() => pollStatus(videoId), pollIntervalMs)
    pollingTimers.set(videoId, timer)
  }

  const processSignal = (message: any) => {
    if (!message?.id) return
    const payload = extractDeepfakeVideoGeneratingFromMessage(message)
    if (!payload?.videoId) return

    if (!statusByVideoId.value.has(payload.videoId)) {
      setStatus(payload.videoId, {
        videoId: payload.videoId,
        status: 'processing',
        videoUrl: null,
        videoUrlCaption: null,
        thumbnailUrl: null,
        durationSec: null,
        errorMessage: null
      })
    }

    startPolling(payload.videoId)
  }

  const uiByMessageId = computed(() => {
    const result = new Map<string, DeepfakeStatus | null>()

    for (const message of messages()) {
      const payload = extractDeepfakeVideoGeneratingFromMessage(message)
      if (!payload?.videoId) {
        result.set(message.id, null)
        continue
      }
      const polled = statusByVideoId.value.get(payload.videoId)
      result.set(message.id, polled ?? {
        videoId: payload.videoId,
        status: 'processing',
        videoUrl: null,
        videoUrlCaption: null,
        thumbnailUrl: null,
        durationSec: null,
        errorMessage: null
      })
    }

    return result
  })

  const clearAll = () => {
    for (const timer of pollingTimers.values()) clearInterval(timer)
    pollingTimers.clear()
    pollingStartedAt.clear()
    pollingInFlight.clear()
    statusByVideoId.value = new Map()
  }

  return {
    deepfakeUiByMessageId: uiByMessageId,
    processDeepfakeSignal: processSignal,
    clearDeepfakePolling: clearAll
  }
}
