<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { VishingCallStartedPayload, VishingCallTranscriptPayload } from '../utils/message-utils'

const props = defineProps<{
  started: VishingCallStartedPayload | null
  transcript: VishingCallTranscriptPayload | null
}>()

const callStatus = computed(() => {
  return props.transcript?.status || props.started?.status || 'ringing'
})

const callStatusLabel = computed(() => {
  const status = callStatus.value.toLowerCase()
  if (status === 'done') return 'Call Completed'
  if (status === 'failed') return 'Call Failed'
  if (status === 'timeout') return 'Call Timed Out'
  if (status === 'in-progress') return 'Call In Progress'
  if (status === 'initiated') return 'Calling'
  if (status === 'ringing') return 'Dialing'
  return status.charAt(0).toUpperCase() + status.slice(1)
})

const isTerminalStatus = computed(() => {
  const status = callStatus.value.toLowerCase()
  return status === 'done' || status === 'failed' || status === 'timeout'
})

const elapsedSeconds = computed(() => {
  const items = props.transcript?.transcript || []
  if (!items.length) return 0
  return Number(items[items.length - 1]?.timestamp || 0)
})

const totalSeconds = computed(() => {
  return Number(props.transcript?.callDurationSecs || elapsedSeconds.value || 0)
})

const recordingUrl = computed(() => {
  const raw = props.transcript?.recordingUrl
  return typeof raw === 'string' && raw.length > 0 ? raw : ''
})

const conversationId = computed(() => {
  const id = props.transcript?.conversationId || props.started?.conversationId || ''
  return typeof id === 'string' ? id : ''
})

const hasAudio = computed(() => {
  return Boolean(props.transcript?.hasAudio || recordingUrl.value)
})

const proxiedAudioSrc = computed(() => {
  if (recordingUrl.value) {
    return `/api/vishing/audio?url=${encodeURIComponent(recordingUrl.value)}`
  }
  if (conversationId.value && (hasAudio.value || isTerminalStatus.value)) {
    return `/api/vishing/audio?conversationId=${encodeURIComponent(conversationId.value)}`
  }
  return ''
})

const audioLoadError = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
const progressTrackRef = ref<HTMLDivElement | null>(null)
const isMinimized = ref(false)
const isTranscriptOpen = ref(true)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const audioRetryTick = ref(0)
const AUDIO_RETRY_DELAY_MS = 1500
const AUDIO_MAX_RETRIES = 8
const waveformBars = Array.from({ length: 84 }, (_, i) => {
  const waveA = Math.sin(i * 0.42)
  const waveB = Math.cos(i * 0.18 + 1.2)
  return 5 + Math.round(Math.abs((waveA * 0.65) + (waveB * 0.35)) * 22)
})
watch(proxiedAudioSrc, () => {
  audioLoadError.value = false
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  audioRetryTick.value = 0
})

const resolvedAudioSrc = computed(() => {
  if (!proxiedAudioSrc.value) return ''
  const separator = proxiedAudioSrc.value.includes('?') ? '&' : '?'
  return `${proxiedAudioSrc.value}${separator}_t=${audioRetryTick.value}`
})

const cardStateKey = computed(() => {
  return `vishing-card-state:${conversationId.value || 'unknown'}`
})

watch(cardStateKey, (key) => {
  if (typeof window === 'undefined') return
  if (!conversationId.value) {
    isTranscriptOpen.value = true
    return
  }
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    isTranscriptOpen.value = true
    return
  }
  try {
    const parsed = JSON.parse(raw)
    isTranscriptOpen.value = parsed?.isTranscriptOpen !== false
  } catch {
    isTranscriptOpen.value = true
  }
}, { immediate: true })

watch([isTranscriptOpen, cardStateKey], ([transcriptOpen, key]) => {
  if (typeof window === 'undefined') return
  if (!conversationId.value) return
  window.localStorage.setItem(key, JSON.stringify({
    isTranscriptOpen: Boolean(transcriptOpen)
  }))
})

const toggleAudio = async () => {
  if (!audioRef.value) return
  if (audioRef.value.paused) {
    await audioRef.value.play()
    return
  }
  audioRef.value.pause()
}

const onLoadedMetadata = () => {
  if (!audioRef.value) return
  duration.value = Number.isFinite(audioRef.value.duration) ? audioRef.value.duration : 0
  currentTime.value = audioRef.value.currentTime || 0
  audioLoadError.value = false
}

const onTimeUpdate = () => {
  if (!audioRef.value) return
  currentTime.value = audioRef.value.currentTime || 0
  if (!duration.value && Number.isFinite(audioRef.value.duration)) {
    duration.value = audioRef.value.duration
  }
}

const seekTo = (event: MouseEvent) => {
  if (!audioRef.value || !progressTrackRef.value) return
  const rect = progressTrackRef.value.getBoundingClientRect()
  if (!rect.width) return
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const total = duration.value || totalSeconds.value
  const next = total * ratio
  audioRef.value.currentTime = next
  currentTime.value = next
}

const onTranscriptToggle = (event: Event) => {
  const details = event.currentTarget as HTMLDetailsElement | null
  if (!details) return
  isTranscriptOpen.value = details.open
}

const onAudioError = () => {
  audioLoadError.value = true
  if (!isTerminalStatus.value) return
  if (audioRetryTick.value >= AUDIO_MAX_RETRIES - 1) return
  setTimeout(() => {
    audioRetryTick.value += 1
    audioLoadError.value = false
  }, AUDIO_RETRY_DELAY_MS)
}

function formatMmSs(rawSeconds: number) {
  const seconds = Math.max(0, Math.floor(rawSeconds || 0))
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const progressPercent = computed(() => {
  const total = duration.value || totalSeconds.value
  if (!total) return 0
  return Math.max(0, Math.min(100, (currentTime.value / total) * 100))
})

const waveProgress = computed(() => {
  return (progressPercent.value / 100) * waveformBars.length
})

const waveFillForIndex = (idx: number) => {
  const fill = waveProgress.value - idx
  return Math.max(0, Math.min(1, fill))
}

const waveBarStyle = (idx: number, height: number) => {
  const fill = waveFillForIndex(idx)
  let background = '#cbd5e1'
  if (fill >= 1) background = '#3b82f6'
  else if (fill > 0) background = `rgba(59, 130, 246, ${0.3 + (fill * 0.6)})`

  return {
    height: `${height}px`,
    backgroundColor: background,
    animationDelay: `${idx * 38}ms`
  }
}
</script>

<template>
  <div class="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-gray-700 dark:bg-gray-950">
    <div class="px-4 py-3 md:px-5 md:py-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
          <UIcon :name="isPlaying ? 'i-lucide-volume-2' : 'i-lucide-audio-lines'" class="h-4 w-4" />
          <span class="text-sm font-medium">Vishing Call</span>
        </div>
        <div class="text-xs flex items-center gap-2">
          <UBadge
            :color="callStatus === 'done' ? 'success' : (callStatus === 'failed' || callStatus === 'timeout') ? 'error' : 'warning'"
            variant="soft"
            size="xs"
          >
            {{ callStatusLabel }}
          </UBadge>
          <button
            v-if="isTerminalStatus"
            type="button"
            class="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-gray-800 dark:hover:text-slate-100"
            :aria-label="isMinimized ? 'Expand card' : 'Minimize card'"
            @click="isMinimized = !isMinimized"
          >
            <UIcon :name="isMinimized ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" class="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        v-if="isTerminalStatus && !isMinimized"
        class="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 relative"
      >
        <div class="flex items-center gap-4 text-slate-700 dark:text-slate-200">
          <button
            type="button"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!resolvedAudioSrc"
            aria-label="Play or pause"
            @click="toggleAudio"
          >
            <UIcon :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" class="h-3.5 w-3.5" />
          </button>
          <div
            ref="progressTrackRef"
            class="min-w-0 flex-1 cursor-pointer px-1 py-2"
            @click="seekTo"
          >
            <div class="flex w-full items-center gap-0.5">
              <div
                v-for="(height, idx) in waveformBars"
                :key="idx"
                class="wave-bar flex-1 rounded-full transition-all duration-150"
                :class="isPlaying ? 'wave-bar-playing' : ''"
                :style="waveBarStyle(idx, height)"
              />
            </div>
          </div>
        </div>
        <div class="mt-1 flex justify-end">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-300 absolute right-4 bottom-2">
            {{ formatMmSs(currentTime) }} / {{ formatMmSs(duration || totalSeconds) }}
          </span>
        </div>

        <audio
          v-if="resolvedAudioSrc"
          ref="audioRef"
          class="hidden"
          :src="resolvedAudioSrc"
          preload="metadata"
          @error="onAudioError"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="isPlaying = true"
          @pause="isPlaying = false"
          @ended="isPlaying = false"
        />
        <p v-if="audioLoadError" class="mt-1 text-[11px] text-red-500">
          Audio yuklenemedi.
        </p>
      </div>
      <details
        v-if="isTerminalStatus && !isMinimized && transcript?.transcript?.length"
        class="transcript-details mt-3 rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        :open="isTranscriptOpen"
        @toggle="onTranscriptToggle"
      >
        <summary class="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200">
          <div class="flex items-center justify-between">
            <span>Transcript ({{ transcript?.transcript?.length || 0 }})</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="h-4 w-4 text-slate-500 transition-transform duration-200"
              :class="isTranscriptOpen ? 'rotate-180' : ''"
            />
          </div>
        </summary>
        <div class="max-h-56 overflow-auto border-t border-gray-200 px-2.5 py-2 space-y-1.5 dark:border-gray-700">
          <div
            v-for="(entry, index) in (transcript?.transcript || [])"
            :key="index"
            class="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-950"
          >
            <div class="flex items-center justify-between gap-2 text-[11px]">
              <span class="font-semibold uppercase tracking-wide" :class="entry.role === 'agent' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'">
                {{ entry.role === 'agent' ? 'Agent' : 'User' }}
              </span>
              <span class="text-muted-foreground">
                {{ Number(entry.timestamp || 0).toFixed(1) }}s
              </span>
            </div>
            <p class="mt-1 whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-200">
              {{ entry.message }}
            </p>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.wave-bar {
  transform-origin: center center;
}

.wave-bar-playing {
  animation: wavePulse 1.1s ease-in-out infinite;
}

@keyframes wavePulse {
  0% { transform: scaleY(0.7); }
  50% { transform: scaleY(1.2); }
  100% { transform: scaleY(0.7); }
}

</style>
