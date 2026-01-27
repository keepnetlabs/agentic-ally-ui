import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useRouteParams } from './useRouteParams'

export const useAuthToken = () => {
  const { companyId, baseApiUrl } = useRouteParams()
  const storageKey = computed(() => {
    const company = (companyId.value || '').trim()
    const base = (baseApiUrl.value || '').trim()
    if (company || base) {
      return `accessToken:${company || 'unknown'}:${base || 'unknown'}`
    }
    return 'accessToken'
  })

  // Use VueUse's useStorage for reactive localStorage access
  const token = useStorage(storageKey, '')
  const legacyToken = useStorage('accessToken', '')
  const resolvedToken = computed(() => {
    if (token.value) {
      return token.value
    }
    return legacyToken.value
  })

  const setToken = (newToken: string) => {
    token.value = newToken
    if (storageKey.value === 'accessToken') {
      legacyToken.value = newToken
    }
  }

  const clearToken = () => {
    token.value = null
    if (storageKey.value === 'accessToken') {
      legacyToken.value = null
    }
  }

  const getToken = () => {
    return resolvedToken.value
  }

  return {
    token: computed(() => resolvedToken.value || ''), // Return as readonly computed to match previous interface and ensure string type
    setToken,
    clearToken,
    getToken
  }
}
