<script setup lang="ts">
const input = ref('')
const loading = ref(false)
const route = useRoute()

const { model } = useLLM()

// Get sessionId from URL query (passed by parent iframe)
const sessionId = route.query.sessionId as string

async function createChat(prompt: string) {
  loading.value = true
  try {
    console.log('Creating chat with prompt:', prompt)
    const url = sessionId ? `/api/chats?sessionId=${sessionId}` : '/api/chats'
    const chat = await $fetch(url, {
      method: 'POST',
      body: { prompt },
      credentials: 'include'
    })
    console.log('Chat created:', chat)
    console.log('Chat ID:', chat?.id)
    console.log('Full chat object:', JSON.stringify(chat))

    if (!chat?.id) {
      console.error('Chat ID missing!', chat)
      return
    }

    refreshNuxtData('chats')

    // Build chat URL with all query parameters (sessionId, accessToken, baseApiUrl)
    const params = new URLSearchParams()
    if (sessionId) params.append('sessionId', sessionId)
    const accessToken = route.query.accessToken as string
    if (accessToken) params.append('accessToken', accessToken)
    const baseApiUrl = route.query.baseApiUrl as string
    if (baseApiUrl) params.append('baseApiUrl', baseApiUrl)

    const queryString = params.toString()
    const chatUrl = `/chat/${chat.id}${queryString ? '?' + queryString : ''}`
    navigateTo(chatUrl)
  } catch(e) {
    console.error('Error creating chat:', e)
  } finally {
    loading.value = false
  }
}

function onSubmit() {
  if (!input.value.trim() || loading.value) return
  const prompt = input.value.trim()
  input.value = ''
  createChat(prompt)
}

const quickChats = [
  {
    label: 'Create Phishing Awareness',
    icon: 'i-lucide-shield-alert'
  },
  {
    label: 'Create Quishing Awareness',
    icon: 'i-lucide-qr-code'
  },
  {
    label: 'Secure Remote Work Basics',
    icon: 'i-lucide-laptop'
  },
  {
    label: 'MFA',
    icon: 'i-lucide-shield-check'
  },
  {
    label: 'Create Strong Passwords',
    icon: 'i-lucide-key-round'
  }
]
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col justify-center gap-4 sm:gap-6 py-8">
        <h1 class="text-3xl sm:text-4xl text-highlighted font-bold">
          How can I help you today?
        </h1>

        <UChatPrompt
          v-model="input"
          :status="loading ? 'streaming' : 'ready'"
          class="[view-transition-name:chat-prompt]"
          variant="subtle"
          autocomplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          @submit="onSubmit"
        >
          <UChatPromptSubmit color="neutral" :status="loading ? 'streaming' : 'ready'" />

          <template #footer>
            <ModelSelect v-model="model" />
          </template>
        </UChatPrompt>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="quickChat in quickChats"
            :key="quickChat.label"
            :icon="quickChat.icon"
            :label="quickChat.label"
            :disabled="loading"
            size="sm"
            color="neutral"
            variant="outline"
            class="rounded-full"
            @click="createChat(quickChat.label)"
          />
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
