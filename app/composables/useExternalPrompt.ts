import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'

type UseExternalPromptOptions = {
  input: Ref<string>
  promptRef: Ref<unknown>
  onSend?: (prompt: string) => void
}

export const useExternalPrompt = ({ input, promptRef, onSend }: UseExternalPromptOptions) => {
  const handleExternalPromptMessage = (event: MessageEvent) => {
    const data = event?.data ?? {}
    if (!data || data.type !== 'ui:uploadClick') {
      return
    }

    const payload = data.payload ?? {}
    const rawPrompt = typeof payload.prompt === 'string' ? payload.prompt : ''
    const prompt = rawPrompt.trim()
    if (!prompt) {
      return
    }

    const currentValue = input.value?.trim() ?? ''
    const nextValue = currentValue
      ? (currentValue.includes(prompt) ? currentValue : `${currentValue}\n${prompt}`)
      : prompt

    input.value = nextValue

    if (payload.autoSend === true && onSend) {
      onSend(prompt)
      return
    }

    nextTick(() => {
      const element = (promptRef.value as { $el?: HTMLElement } | null)?.$el
      const inputEl = element?.querySelector('textarea, input') as HTMLTextAreaElement | HTMLInputElement | null
      if (!inputEl) {
        return
      }
      inputEl.focus()
      inputEl.setSelectionRange(input.value.length, input.value.length)
    })
  }

  onMounted(() => {
    window.addEventListener('message', handleExternalPromptMessage)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleExternalPromptMessage)
  })
}
