<script setup lang="ts">
import { computed, ref, watch } from 'vue'
// @ts-ignore - Nuxt auto-imports are typed via generated #imports during dev
import { navigateTo, refreshNuxtData, useColorMode, useToast } from '#imports'
import { useRouteParams } from '../composables/useRouteParams'
import { useAuthToken } from '../composables/useAuthToken'
import { useSecureApi } from '../composables/useSecureApi'
import { parseError } from '../utils/error-handler'

const input = ref('')
const loading = ref(false)
const colorMode = useColorMode()
const toast = useToast()

const { buildUrl, companyId, baseApiUrl, sessionId } = useRouteParams()
const { token: accessToken } = useAuthToken()
const { secureFetch } = useSecureApi()
const hasAccessToken = computed(() => Boolean(accessToken.value))
const hasSessionId = computed(() => Boolean(sessionId.value))
const isAuthReady = computed(() => hasAccessToken.value)
const pendingPrompt = ref<string | null>(null)
const hasShownAuthToast = ref(false)

interface CreateChatResponse {
  id: string
}

// Image based on color mode
const imageUrl = computed(() => {
  const isDark = colorMode.value === 'dark'
  const imageId = isDark ? '3b1fa0ba-b074-4161-2168-50d09496a500' : 'bdb52584-b37f-4789-cf95-2a2a2d58a300'
  return `https://imagedelivery.net/KxWh-mxPGDbsqJB3c5_fmA/${imageId}/public`
})

async function createChat(prompt: string) {
  loading.value = true
  try {
    const url = buildUrl('/api/chats')
    const chat = await secureFetch<CreateChatResponse>(url, {
      method: 'POST',
      body: { prompt },
      credentials: 'include',
      headers: {
        ...(accessToken.value ? { 'X-AGENTIC-ALLY-TOKEN': accessToken.value } : {}),
        ...(companyId.value ? { 'X-COMPANY-ID': companyId.value } : {}),
        ...(baseApiUrl.value ? { 'X-BASE-API-URL': baseApiUrl.value } : {})
      }
    })
    if (!chat?.id) {
      return
    }

    refreshNuxtData('chats')

    const chatUrl = buildUrl(`/chat/${chat.id}`)
    navigateTo(chatUrl)
  } catch (error) {
    const { title, message, icon } = parseError(error)
    toast.add({
      title: title || 'Request failed',
      description: message || 'Failed to create chat',
      icon,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const requestChat = async (prompt: string) => {
  if (!isAuthReady.value) {
    pendingPrompt.value = prompt
    if (!hasShownAuthToast.value) {
      hasShownAuthToast.value = true
      if (!hasAccessToken.value) {
        toast.add({
          title: 'Preparing session',
          description: 'Waiting for authentication before sending your prompt.',
          icon: 'i-lucide-loader',
          color: 'warning'
        })
      }
    }
    return
  }
  if (!hasSessionId.value) {
    toast.add({
      title: 'Missing sessionId',
      description: 'The sessionId is missing from the URL. Request may fail.',
      icon: 'i-lucide-alert-circle',
      color: 'warning'
    })
  }
  await createChat(prompt)
}

function handleSubmit() {
  if (!input.value.trim() || loading.value) return
  const prompt = input.value.trim()
  input.value = ''
  requestChat(prompt)
}

watch(hasAccessToken, (tokenReady) => {
  if (!tokenReady || !pendingPrompt.value || loading.value) {
    return
  }
  const prompt = pendingPrompt.value
  pendingPrompt.value = null
  hasShownAuthToast.value = false
  requestChat(prompt)
})

const quickChats = [
  {
    label: 'Generate Microlearning',
    prompt: 'Generate microlearning',
    icon: 'i-lucide-graduation-cap'
  },
  {
    label: 'Analyze User Behavior',
    prompt: 'Analyze user behavior',
    icon: 'i-lucide-search'
  },
  {
    label: 'Design Phishing Scenario',
    prompt: 'Design a phishing scenario',
    icon: 'phishing'
  }
]

const examplePrompts = [
  'QR phishing training for frontline staff',
  'SQL injection training for backend developers',
  'Secure coding microlearning for API teams',
  'Phishing scenario for fake login pages targeting finance users',
  'Supply-chain security training for procurement and operations teams',
  'Compliance training aligned with ISO, GDPR, and HIPAA requirements'
]
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col justify-center gap-4 sm:gap-6 py-8">
        <img :src="imageUrl" class="mx-auto max-w-32 max-h-32" />
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
          @submit="handleSubmit"
        >
          <UChatPromptSubmit 
            color="info" 
            :status="loading ? 'streaming' : 'ready'"
            :ui="{ 
              base: 'dark:bg-black dark:text-white dark:border-white dark:hover:bg-gray-900'
            }"
          />

        </UChatPrompt>

        <div class="flex flex-wrap gap-2 w-full justify-center">
          <UButton
            v-for="quickChat in quickChats"
            :key="quickChat.label"
            :disabled="loading"
            size="sm"
            color="primary"
            variant="outline"
            :class="[
              'justify-center rounded-full !text-[#383B41] hover:!text-[#383B41] dark:!text-white !border-[#B3D4FC] hover:!border-[#B3D4FC]',
              // <=1024px: just wrap with gap-2, take only as much as content
              'w-auto flex-none max-w-full',
              // >=1024px: 3 equal columns; if it wraps, it won't stretch full-width
              'lg:flex-none lg:basis-[calc((100%-1rem)/3)] lg:max-w-[calc((100%-1rem)/3)] lg:min-w-[220px]'
            ]"
            @click="requestChat(quickChat.prompt)"
          >
            <span class="flex items-center gap-2">
              <PhishingIcon v-if="quickChat.icon === 'phishing'" class="h-4 w-4 text-[#2196F3]" />
              <UIcon v-else :name="quickChat.icon" class="h-4 w-4 text-[#2196F3]" />
              <span>{{ quickChat.label }}</span>
            </span>
          </UButton>
        </div>

        <div class="pt-4">
          <p class="text-[12px] font-semibold text-muted-foreground">
            Here are a few examples <span class="font-semibold">(click to try)</span>:
          </p>
          <div class="mt-2 space-y-1">
            <button
              v-for="(example) in examplePrompts"
              :key="example"
              type="button"
              class="block text-left text-[10px] hover:underline hover:text-primary disabled:opacity-50 disabled:no-underline transition-colors"
              :disabled="loading"
              @click="requestChat(example)"
            >
              {{ example }}
            </button>
          </div>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
