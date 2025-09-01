<script setup lang="ts">
import type { DefineComponent } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useClipboard } from '@vueuse/core'
import ProseStreamPre from '../../components/prose/PreStream.vue'
import { parseAIMessage } from '../../utils/text-utils'

type ServerMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

type ServerChat = {
  id: string
  messages: ServerMessage[]
}

const components = {
  pre: ProseStreamPre as unknown as DefineComponent
}

const route = useRoute()
const toast = useToast()
const clipboard = useClipboard()
const { model } = useLLM()

const chatId = String(route.params.id)

const { data: chat } = await useFetch(`/api/chats/${chatId}`, {
  cache: 'force-cache'
})

if (!chat.value) {
  throw createError({ statusCode: 404, statusMessage: 'Chat not found', fatal: true })
}

// Local input state
const input = ref('')

// Initialize Chat with Default transport (AI SDK Data Stream)
const chatClient = new Chat({
  id: chatId,
  transport: new DefaultChatTransport({
    api: `/api/chats/${chatId}`,
    body: { model: model.value }
  }),
  messages: (chat.value?.messages ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: 'text', text: m.content }]
  })),
  async onFinish() {
    refreshNuxtData('chats')
    const lastMessage = chatClient.messages[chatClient.messages.length - 1]
    const text = parseAIMessage(lastMessage)
    if (text) {
      await fetch(`/api/chats/${chatId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: "assistant", content: text })
      })
    }
  },
  onError(err: any) {
    const message = typeof err?.message === 'string' && err.message[0] === '{' ? JSON.parse(err.message).message : err?.message
    toast.add({
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0
    })
  }
})

/*
  We have two cases here: 
  1. The chat has only one message, which is the user's prompt
  2. The chat has more than one message, which means the assistant has already responded

  In the first case, we need to trigger the assistant to respond.
  In the second case, we need to use the existing messages to continue the conversation.
*/

// Adapter: map UI messages to the structure expected by UChatMessages
const messages = computed(() =>
  (chatClient.messages as any[]).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: parseAIMessage(m)
  }))
)

const status = computed(() => chatClient.status)
const error = computed(() => chatClient.error)

const copied = ref(false)

function copy(e: MouseEvent, message: any) {
  clipboard.copy(message.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function onSubmit() {
  if (!input.value || status.value === 'streaming') return
  chatClient.sendMessage({ text: input.value })
  input.value = ''
}

onMounted(() => {
  if (chat.value?.messages.length === 1) {
    chatClient.regenerate()
  }
})
</script>

<template>
  <UDashboardPanel id="chat" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col gap-4 sm:gap-6">
        <UChatMessages
          :messages="messages"
          :status="status"
          :assistant="{ actions: [{ label: 'Copy', icon: copied ? 'i-lucide-copy-check' : 'i-lucide-copy', onClick: copy }] }"
          class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
          :spacing-offset="160"
        >
          <template #content="{ message }">
            <MDCCached
              :value="message.content"
              :cache-key="message.id"
              unwrap="p"
              :components="components"
              :parser-options="{ highlight: false }"
            />
          </template>
        </UChatMessages>

        <UChatPrompt
          v-model="input"
          :error="error"
          variant="subtle"
          class="sticky bottom-0 [view-transition-name:chat-prompt] rounded-b-none z-10"
          @submit="onSubmit"
        >
          <UChatPromptSubmit
            :status="status"
            color="neutral"
            @stop="() => chatClient.stop()"
            @reload="() => chatClient.regenerate()"
          />

          <template #footer>
            <ModelSelect v-model="model" />
          </template>
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
