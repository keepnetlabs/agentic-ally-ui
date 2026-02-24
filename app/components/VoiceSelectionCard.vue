<script setup lang="ts">
import { computed, ref } from 'vue'

type VoiceItem = {
  voice_id: string
  name: string
  language?: string
  gender?: string
  preview_audio?: string
  emotion_support?: boolean
}

const props = defineProps<{
  payload: {
    voices: VoiceItem[]
    total: number
    requestedLanguage: string | null
    warning: string | null
  }
}>()

const emit = defineEmits<{
  (e: 'select', value: string): void
}>()

const isAutoSelected = computed(() => props.payload.total === 1)
const playingId = ref<string | null>(null)
const audioRefs = new Map<string, HTMLAudioElement>()

const getVoiceKey = (voice: VoiceItem, index: number) => voice.voice_id || `voice-${index}`

const submitSelection = (voice: VoiceItem, index: number) => {
  if (isAutoSelected.value) return
  const fallback = String(index + 1)
  emit('select', voice.name?.trim() || fallback)
}

const setAudioRef = (id: string, el: HTMLAudioElement | null) => {
  if (el) {
    audioRefs.set(id, el)
    return
  }
  audioRefs.delete(id)
}

const togglePreview = async (id: string) => {
  const target = audioRefs.get(id)
  if (!target) return

  if (playingId.value && playingId.value !== id) {
    const current = audioRefs.get(playingId.value)
    if (current) {
      current.pause()
      current.currentTime = 0
    }
  }

  if (target.paused) {
    await target.play().catch(() => null)
    playingId.value = id
    return
  }

  target.pause()
  target.currentTime = 0
  if (playingId.value === id) {
    playingId.value = null
  }
}

const onAudioEnded = (id: string) => {
  if (playingId.value === id) {
    playingId.value = null
  }
}
</script>

<template>
  <div class="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-gray-700 dark:bg-gray-950">
    <div class="px-3 py-2.5 md:px-5 md:py-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <UIcon name="i-lucide-mic" class="h-4 w-4" />
          <span class="text-sm font-medium">Voice Selection</span>
        </div>
        <UBadge :color="isAutoSelected ? 'success' : 'warning'" variant="soft" size="xs">
          {{ isAutoSelected ? 'Auto-selected' : `${payload.total} options` }}
        </UBadge>
      </div>

      <div
        v-if="payload.warning"
        class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
      >
        {{ payload.warning }}
      </div>

      <div class="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="(voice, index) in payload.voices"
          :key="getVoiceKey(voice, index)"
          class="rounded-lg border border-slate-200 bg-white p-2 transition hover:border-slate-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-500"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="truncate text-xs font-medium text-slate-700 dark:text-slate-100" :title="voice.name">
              {{ voice.name }}
            </p>
            <UBadge v-if="voice.emotion_support" color="info" variant="soft" size="xs">E</UBadge>
          </div>

          <div class="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-300">
            <span>{{ voice.language || '-' }}</span>
            <span>|</span>
            <span>{{ voice.gender || '-' }}</span>
          </div>

          <audio
            v-if="voice.preview_audio"
            :ref="(el) => setAudioRef(getVoiceKey(voice, index), el as HTMLAudioElement | null)"
            :src="voice.preview_audio"
            preload="none"
            class="hidden"
            @ended="onAudioEnded(getVoiceKey(voice, index))"
          />

          <div class="mt-2 flex items-center gap-1.5">
            <UButton
              v-if="voice.preview_audio"
              size="xs"
              color="neutral"
              variant="outline"
              :icon="playingId === getVoiceKey(voice, index) ? 'i-lucide-square' : 'i-lucide-play'"
              :aria-label="playingId === getVoiceKey(voice, index) ? `Stop preview for ${voice.name}` : `Play preview for ${voice.name}`"
              @click="togglePreview(getVoiceKey(voice, index))"
            />
            <UButton
              v-if="!isAutoSelected"
              size="xs"
              color="primary"
              variant="soft"
              class="flex-1"
              @click="submitSelection(voice, index)"
            >
              Select
            </UButton>
            <UBadge v-else color="success" variant="soft" size="xs">Auto</UBadge>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
