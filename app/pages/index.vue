<script setup lang="ts">
const input = ref('')
const loading = ref(false)
const colorMode = useColorMode()

const { model } = useLLM()
const { buildUrl, accessToken, companyId, baseApiUrl } = useRouteParams()

// Image based on color mode
const imageUrl = computed(() => {
  const isDark = colorMode.value === 'dark'
  const imageId = isDark ? '3b1fa0ba-b074-4161-2168-50d09496a500' : 'bdb52584-b37f-4789-cf95-2a2a2d58a300'
  return `https://imagedelivery.net/KxWh-mxPGDbsqJB3c5_fmA/${imageId}/public`
})

async function createChat(prompt: string) {
  loading.value = true
  try {
    console.log('Creating chat with prompt:', prompt)
    const url = buildUrl('/api/chats')
    const chat = await $fetch(url, {
      method: 'POST',
      body: { prompt },
      credentials: 'include',
      headers: {
        ...(accessToken.value ? { 'X-AGENTIC-ALLY-TOKEN': accessToken.value } : {}),
        ...(companyId.value ? { 'X-COMPANY-ID': companyId.value } : {}),
        ...(baseApiUrl.value ? { 'X-BASE-API-URL': baseApiUrl.value } : {})
      }
    })
    console.log('Chat created:', chat)
    console.log('Chat ID:', chat?.id)
    console.log('Full chat object:', JSON.stringify(chat))

    if (!chat?.id) {
      console.error('Chat ID missing!', chat)
      return
    }

    refreshNuxtData('chats')

    const chatUrl = buildUrl(`/chat/${chat.id}`)
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
        <img :src="imageUrl" style="max-width: 128px;max-height: 128px; margin: 0 auto;" />
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
          <UChatPromptSubmit 
            color="info" 
            :status="loading ? 'streaming' : 'ready'"
            :ui="{ 
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
          />

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
