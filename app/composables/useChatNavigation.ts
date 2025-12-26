import { ref } from 'vue'

// Global streaming state
const streamingChatId = ref<string | null>(null)
const isStreaming = ref(false)
let stopStreamingFn: (() => void) | null = null

export function useChatNavigation() {
  const setStreaming = (chatId: string, shouldStream: boolean, stopFn?: () => void) => {
    streamingChatId.value = shouldStream ? chatId : null
    isStreaming.value = shouldStream
    if (stopFn) stopStreamingFn = stopFn
  }

  const canNavigate = (targetChatId: string): boolean => {
    // Can always navigate to same chat or if not streaming
    if (!isStreaming.value || streamingChatId.value === targetChatId) {
      return true
    }
    return false
  }

  const stopStreaming = () => {
    if (stopStreamingFn) {
      stopStreamingFn()
    }
    isStreaming.value = false
    streamingChatId.value = null
  }

  return {
    streamingChatId,
    isStreaming,
    setStreaming,
    canNavigate,
    stopStreaming
  }
}
