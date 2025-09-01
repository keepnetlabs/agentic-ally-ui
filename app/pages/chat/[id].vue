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

const input = ref('')

const chatClient = new Chat({
  id: chatId,
  transport: new DefaultChatTransport({
    api: `/api/chats/${chatId}`,
    body: { model: model.value }
  }),
  messages: (chat.value?.messages ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content
  })),
  async onFinish() {
    refreshNuxtData('chats')
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

const messages = computed(() =>
  chatClient.messages.map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content || parseAIMessage(m)
  }))
)
const status = computed(() => chatClient.status)
const error = computed(() => chatClient.error)

function handleSubmit() {
  if (!input.value || status.value === 'streaming') return
  chatClient.sendMessage({ text: input.value })
  input.value = ''
}

function stop() {
  // Chat class doesn't have stop method, need to use AbortController
}

function reload() {
  chatClient.regenerate()
}

const copied = ref(false)

function copy(e: MouseEvent, message: any) {
  clipboard.copy(message.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

onMounted(() => {
  if (chat.value?.messages.length === 1) {
    reload()
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
          @submit="handleSubmit"
        >
          <UChatPromptSubmit
            :status="status"
            color="neutral"
            @stop="stop"
            @reload="reload"
          />

          <template #footer>
            <ModelSelect v-model="model" />
          </template>
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
