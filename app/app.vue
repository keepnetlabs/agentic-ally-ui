<script setup lang="ts">
// @ts-nocheck - Nuxt auto-imports are available at runtime
import { LazyModalConfirm } from '#components'

const colorMode = useColorMode()
const router = useRouter()
const { isStreaming, stopStreaming } = useChatNavigation()
const { code, baseApiUrl, accessToken: queryAccessToken } = useRouteParams()
const { setToken } = useAuthToken()
const { exchangeAuthToken } = useAuthTokenExchange()

// Global streaming check on route navigation
router.beforeEach(async (to, from) => {
  // Check when navigating away from chat while streaming
  if (
    from.name === 'chat-id' &&
    isStreaming.value &&
    (to.name !== 'chat-id' || from.params.id !== to.params.id)
  ) {
    const overlay = useOverlay()
    const instance = overlay.create(LazyModalConfirm, {
      props: {
        title: 'Stop generating?',
        description: 'Your response will be discarded.',
        confirmLabel: 'Stop',
        cancelLabel: 'Keep'
      }
    }).open()

    const confirmed = await instance.result

    if (confirmed) {
      stopStreaming()
      return true // Allow navigation
    } else {
      return false // Prevent navigation
    }
  }

  return true // Allow navigation
})

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
    { name: 'google', content: 'notranslate' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en',
    translate: 'no'
  }
})

const title = 'Keepnet Agentic Ally'
const description = 'The best AI agent for Keepnet'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://assets.hub.nuxt.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2NoYXQtdGVtcGxhdGUubnV4dC5kZXYiLCJpYXQiOjE3NDI4NDY2ODB9.n4YCsoNz8xatox7UMoYZFNo7iS1mC_DT0h0A9cKRoTw.jpg?theme=light',
  twitterImage: 'https://assets.hub.nuxt.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2NoYXQtdGVtcGxhdGUubnV4dC5kZXYiLCJpYXQiOjE3NDI4NDY2ODB9.n4YCsoNz8xatox7UMoYZFNo7iS1mC_DT0h0A9cKRoTw.jpg?theme=light',
  twitterCard: 'summary_large_image'
})

// Safari iframe cookie fix
const showSafariPrompt = ref(false)
const accessDenied = ref(false)
const siteOpened = ref(false)
const siteUrl = ref('')

// Gerçek aktif mode'u al (sadece 'dark' veya 'light')
const getActiveMode = () => {
  const mode = colorMode.value
  // 'system' ise gerçek mode'u kontrol et
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode === 'dark' ? 'dark' : 'light'
}

const sendColorModeToParent = () => {
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'COLOR_MODE',
      mode: getActiveMode()
    }, '*')
  }
}

const canUseStorage = () => {
  try {
    const probeKey = '__storage_probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return true
  } catch (e) {
    return false
  }
}

onMounted(async () => {
  siteUrl.value = window.location.origin

  // Sadece Safari'de çalışsın
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isInIframe = window.parent !== window
  const hasStorageApi = 'requestStorageAccess' in document

  // Safari iframe cookie/storage access kontrolü
  if (isSafari && isInIframe && hasStorageApi) {
    try {
      const hasAccess = await document.hasStorageAccess()
      if (!hasAccess) {
        showSafariPrompt.value = true
        return
      }
    } catch (e) {
      console.log('Storage Access API not available')
    }
  }

  if (!canUseStorage()) {
    return
  }

  // İlk cookie set et
  $fetch('/api/ping').catch(() => {})

  // Handle direct accessToken from query (Migration/Fallback logic)
  if (queryAccessToken.value) {
    try {
      setToken(queryAccessToken.value)
    } catch (e) {
      console.warn('Failed to set token from query', e)
    }
  }

  // Handle auth code exchange if present
  if (code.value && baseApiUrl.value) {
    await exchangeAuthToken(code.value, baseApiUrl.value)
  }

  // Color mode'u parent'a gönder (iframe içindeyse)
  sendColorModeToParent()

  // System preference değiştiğinde de bildir
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', sendColorModeToParent)
  }

  // Safari'de iframe prompt'u yukarıda ele alindi
})

// Color mode değiştiğinde parent'a bildir
watch(colorMode, () => {
  sendColorModeToParent()
})

async function requestSafariAccess() {
  try {
    await document.requestStorageAccess()
    showSafariPrompt.value = false
    location.reload()
  } catch (e) {
    console.error('Storage access denied:', e)
    // Safari denied - first-party ziyaret gerekli
    accessDenied.value = true
  }
}

function openSiteAndRetry() {
  // Siteyi yeni sekmede aç
  window.open(siteUrl.value, '_blank')
  // Flag set et
  siteOpened.value = true
}

function tryAgain() {
  // Reset ve tekrar dene
  accessDenied.value = false
  siteOpened.value = false
  requestSafariAccess()
}
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <!-- Safari iframe prompt -->
    <div v-if="showSafariPrompt" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <UIcon name="i-lucide-cookie" class="w-8 h-8 text-amber-500" />
          <h3 class="text-lg font-semibold">{{ accessDenied ? 'Cookie Access Required' : 'Enable Cookies' }}</h3>
        </div>
        
        <div v-if="!accessDenied">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            To use this chat, Safari needs permission to use cookies. Click the button below to enable.
          </p>
          <UButton block @click="requestSafariAccess" color="primary">
            Enable & Continue
          </UButton>
        </div>
        
        <div v-else>
          <div v-if="!siteOpened">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Safari blocked cookie access. To fix this:
            </p>
            <ol class="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-2 list-decimal list-inside">
              <li>Visit <strong>{{ siteUrl }}</strong> directly</li>
              <li><strong>Click anywhere</strong> on that site (required by Safari)</li>
              <li>Come back here and click "Try Again"</li>
            </ol>
            <UButton block @click="openSiteAndRetry" color="primary">
              Open Site
            </UButton>
          </div>
          
          <div v-else>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              ✅ Great! Now that you've visited the site, click below to enable cookies.
            </p>
            <UButton block @click="tryAgain" color="primary">
              Try Again
            </UButton>
          </div>
        </div>
      </div>
    </div>
    
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
