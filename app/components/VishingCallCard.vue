<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  VishingCallStartedPayload,
  VishingCallTranscriptPayload,
  VishingConversationSummaryPayload,
  VishingNextStepItem
} from '../utils/message-utils'

const props = defineProps<{
  started: VishingCallStartedPayload | null
  transcript: VishingCallTranscriptPayload | null
  summary: VishingConversationSummaryPayload | null
}>()

const emit = defineEmits<{
  createNextStep: [nextStep: VishingNextStepItem]
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
const activeTab = ref<'summary' | 'transcript' | 'next-steps'>('summary')
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const audioRetryTick = ref(0)
const audioRetryTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const AUDIO_RETRY_DELAY_MS = 1500
const AUDIO_MAX_RETRIES = 8
const waveformBars = Array.from({ length: 84 }, (_, i) => {
  const waveA = Math.sin(i * 0.42)
  const waveB = Math.cos(i * 0.18 + 1.2)
  return 5 + Math.round(Math.abs((waveA * 0.65) + (waveB * 0.35)) * 22)
})
watch(proxiedAudioSrc, () => {
  if (audioRetryTimer.value) {
    clearTimeout(audioRetryTimer.value)
    audioRetryTimer.value = null
  }
  audioLoadError.value = false
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  audioRetryTick.value = 0
})

onBeforeUnmount(() => {
  if (audioRetryTimer.value) {
    clearTimeout(audioRetryTimer.value)
    audioRetryTimer.value = null
  }
})

const resolvedAudioSrc = computed(() => {
  if (!proxiedAudioSrc.value) return ''
  const separator = proxiedAudioSrc.value.includes('?') ? '&' : '?'
  return `${proxiedAudioSrc.value}${separator}_t=${audioRetryTick.value}`
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

const onAudioError = () => {
  if (audioRetryTimer.value) {
    clearTimeout(audioRetryTimer.value)
    audioRetryTimer.value = null
  }
  if (!isTerminalStatus.value) return
  if (audioRetryTick.value >= AUDIO_MAX_RETRIES - 1) {
    audioLoadError.value = true
    return
  }
  audioLoadError.value = false
  audioRetryTimer.value = setTimeout(() => {
    audioRetryTick.value += 1
    audioRetryTimer.value = null
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

const statusCardUi = computed(() => {
  const card = props.summary?.statusCard
  if (!card?.title && !card?.description) return null

  const variant = (card.variant || '').toLowerCase()
  if (variant === 'warning') {
    return {
      box: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20',
      title: 'text-red-600 dark:text-red-300',
      desc: 'text-red-700 dark:text-red-200',
      icon: 'i-lucide-triangle-alert',
      iconWrap: 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-300'
    }
  }
  if (variant === 'success') {
    return {
      box: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      title: 'text-emerald-700 dark:text-emerald-300',
      desc: 'text-emerald-700 dark:text-emerald-200',
      icon: 'i-lucide-circle-check',
      iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
    }
  }
  return {
    box: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30',
    title: 'text-slate-800 dark:text-slate-100',
    desc: 'text-slate-600 dark:text-slate-300',
    icon: 'i-lucide-info',
    iconWrap: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
  }
})

const timelineLabelClass = (label?: string) => {
  const key = (label || '').trim().toLowerCase()
  if (key === 'introduction') return 'text-indigo-500 dark:text-indigo-300'
  if (key === 'credibility building') return 'text-violet-500 dark:text-violet-300'
  if (key === 'pressure') return 'text-rose-500 dark:text-rose-300'
  if (key === 'data request') return 'text-amber-500 dark:text-amber-300'
  if (key === 'data disclosed') return 'text-red-500 dark:text-red-300'
  if (key === 'simulation reveal') return 'text-emerald-600 dark:text-emerald-300'
  return 'text-slate-500 dark:text-slate-300'
}

watch(() => props.summary, (next) => {
  if (!next) return
  activeTab.value = 'summary'
})
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
        <div
          v-if="props.summary?.statusCard"
          class="mb-3 rounded-xl border px-3 py-2"
          :class="statusCardUi?.box"
        >
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="statusCardUi?.iconWrap">
              <UIcon :name="statusCardUi?.icon || 'i-lucide-info'" class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <p class="text-lg font-semibold leading-tight" :class="statusCardUi?.title">
                {{ props.summary?.statusCard?.title || 'Summary' }}
              </p>
              <p class="text-sm" :class="statusCardUi?.desc">
                {{ props.summary?.statusCard?.description || '' }}
              </p>
            </div>
          </div>
        </div>

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
          Audio failed to load.
        </p>
      </div>

      <div v-if="isTerminalStatus && !isMinimized && props.summary" class="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div class="flex items-center gap-5 border-b border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
          <button
            type="button"
            class="pb-1 font-semibold transition-colors"
            :class="activeTab === 'summary' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100'"
            @click="activeTab = 'summary'"
          >
            Summary
          </button>
          <button
            type="button"
            class="pb-1 font-semibold transition-colors"
            :class="activeTab === 'transcript' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100'"
            @click="activeTab = 'transcript'"
          >
            Transcript
          </button>
          <button
            type="button"
            class="pb-1 font-semibold transition-colors"
            :class="activeTab === 'next-steps' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100'"
            @click="activeTab = 'next-steps'"
          >
            Next Steps
          </button>
        </div>

        <div v-if="activeTab === 'summary'" class="space-y-3 px-3 py-3">
          <p class="text-sm text-slate-700 dark:text-slate-200">
            <span class="font-semibold text-slate-500 dark:text-slate-300">Total Time</span>
            {{ formatMmSs(totalSeconds) }}
          </p>
          <div v-if="props.summary?.summary?.timeline?.length" class="space-y-2">
            <p class="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-300">Simulation Timeline</p>
            <div
              v-for="(item, index) in props.summary?.summary?.timeline || []"
              :key="index"
              class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <div class="grid grid-cols-[3.5rem_10rem_minmax(0,1fr)] items-start gap-2">
                <span class="text-slate-400">{{ item.timestamp }}</span>
                <span class="font-semibold" :class="timelineLabelClass(item.label)">{{ item.label }}</span>
                <span class="text-slate-700 dark:text-slate-200">{{ item.snippet }}</span>
              </div>
            </div>
          </div>

          <div v-if="props.summary?.summary?.disclosedInfo?.length" class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-300">Disclosed Information</p>
              <span class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {{ props.summary?.summary?.disclosedInfo?.length || 0 }} {{ (props.summary?.summary?.disclosedInfo?.length || 0) === 1 ? 'item' : 'items' }}
              </span>
            </div>
            <div class="space-y-2">
              <div
                v-for="(info, index) in props.summary?.summary?.disclosedInfo || []"
                :key="index"
                class="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-2 dark:border-red-900/40 dark:bg-red-950/20"
              >
                <div class="min-w-0 flex items-center gap-2">
                  <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-red-950/40">
                    <UIcon name="i-lucide-triangle-alert" class="h-3.5 w-3.5 text-red-500 dark:text-red-300" />
                  </span>
                  <span class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{{ info.item }}</span>
                </div>
                <span class="shrink-0 rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {{ info.timestamp }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'transcript'" class="max-h-64 space-y-2 overflow-auto px-3 py-3">
          <div
            v-for="(entry, index) in (transcript?.transcript || [])"
            :key="index"
            class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-950"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                :class="entry.role === 'agent'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'"
              >
                {{ entry.role === 'agent' ? 'Agent' : 'User' }}
              </span>
              <span class="shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-300">
                {{ Number(entry.timestamp || 0).toFixed(1) }}s
              </span>
            </div>
            <p class="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-700 dark:text-slate-200">
              {{ entry.message }}
            </p>
          </div>
          <p v-if="!(transcript?.transcript?.length)" class="text-sm text-slate-500 dark:text-slate-300">
            No transcript lines yet.
          </p>
        </div>

        <div v-if="activeTab === 'next-steps'" class="space-y-2 px-3 py-3">
          <div
            v-for="(step, index) in props.summary?.nextSteps || []"
            :key="index"
            class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-950"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ step.title }}</p>
                <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{{ step.description }}</p>
              </div>
              <UButton
                size="xs"
                color="info"
                variant="soft"
                icon="i-lucide-wand-sparkles"
                class="shrink-0"
                @click="emit('createNextStep', step)"
              >
                Create
              </UButton>
            </div>
          </div>
          <p v-if="!(props.summary?.nextSteps?.length)" class="text-sm text-slate-500 dark:text-slate-300">
            No next steps provided.
          </p>
        </div>
      </div>

      <div
        v-if="isTerminalStatus && !isMinimized && !props.summary"
        class="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="flex items-start gap-2 px-3 py-3">
          <UIcon name="i-lucide-loader-2" class="mt-0.5 h-4 w-4 animate-spin text-blue-500" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Analysis is being generated...</p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
              Summary and next steps will appear here shortly.
            </p>
          </div>
        </div>

        <details
          v-if="transcript?.transcript?.length"
          class="border-t border-gray-200 dark:border-gray-700"
          open
        >
          <summary class="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200">
            Transcript ({{ transcript?.transcript?.length || 0 }})
          </summary>
          <div class="max-h-56 overflow-auto border-t border-gray-200 px-2.5 py-2 space-y-2 dark:border-gray-700">
            <div
              v-for="(entry, index) in (transcript?.transcript || [])"
              :key="index"
              class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-950"
            >
              <div class="flex items-center justify-between gap-2">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  :class="entry.role === 'agent'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'"
                >
                  {{ entry.role === 'agent' ? 'Agent' : 'User' }}
                </span>
                <span class="shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-300">
                  {{ Number(entry.timestamp || 0).toFixed(1) }}s
                </span>
              </div>
              <p class="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-700 dark:text-slate-200">
                {{ entry.message }}
              </p>
            </div>
          </div>
        </details>
      </div>
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
