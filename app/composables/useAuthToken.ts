import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

export const useAuthToken = () => {
  // Use VueUse's useStorage for reactive localStorage access
  const token = useStorage('accessToken', '')

  const setToken = (newToken: string) => {
    token.value = newToken
  }

  const clearToken = () => {
    token.value = null
  }

  const getToken = () => {
    return token.value
  }

  return {
    token: computed(() => token.value || ''), // Return as readonly computed to match previous interface and ensure string type
    setToken,
    clearToken,
    getToken
  }
}
