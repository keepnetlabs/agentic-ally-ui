<script setup lang="ts">
import { computed } from 'vue'
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

const callProgressText = computed(() => {
  const status = callStatus.value.toLowerCase()
  if (status === 'done') return 'Call ended.'
  if (status === 'failed') return 'Call failed or was rejected.'
  if (status === 'timeout') return 'Call status unknown. Check ElevenLabs dashboard.'
  if (status === 'in-progress') return 'Call in progress...'
  return 'Calling...'
})

const isTerminal = computed(() => {
  const status = callStatus.value.toLowerCase()
  return status === 'done' || status === 'failed' || status === 'timeout'
})

</script>

<template>
  <div v-if="started || transcript" class="mb-2">
    <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="text-xs flex items-center gap-2">
          <UIcon
            :name="callStatus === 'done' ? 'i-lucide-phone-off' : 'i-lucide-phone-call'"
            class="w-3.5 h-3.5"
          />
          <span class="font-medium">Vishing Call</span>
          <UBadge
            :color="callStatus === 'done' ? 'success' : (callStatus === 'failed' || callStatus === 'timeout') ? 'error' : 'warning'"
            variant="soft"
            size="xs"
          >
            {{ callStatusLabel }}
          </UBadge>
        </div>
      </div>

      <p class="mt-2 text-xs text-muted-foreground">
        <UIcon
          v-if="!isTerminal"
          name="i-lucide-loader-2"
          class="mr-1 inline-block h-3 w-3 animate-spin"
        />
        {{ callProgressText }}
      </p>

      <details
        v-if="transcript?.transcript?.length"
        class="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      >
        <summary class="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200">
          Transcript ({{ transcript.transcript.length }})
        </summary>
        <div class="max-h-56 overflow-auto border-t border-gray-200 dark:border-gray-700 px-2.5 py-2 space-y-1.5">
          <div
            v-for="(entry, index) in transcript.transcript"
            :key="index"
            class="rounded border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-2 py-1.5"
          >
            <div class="flex items-center justify-between gap-2 text-[11px]">
              <span class="font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
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
