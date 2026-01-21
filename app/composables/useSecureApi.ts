import { useAuthToken } from './useAuthToken'

export const useSecureApi = () => {
  const { token, clearToken } = useAuthToken()
  const toast = useToast()

  const secureFetch = async <T = unknown>(url: string, options: any = {}): Promise<T> => {
    try {
      const headers = {
        ...options.headers,
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {})
      }

      return (await $fetch<T>(url, {
        ...options,
        headers
      })) as T
    } catch (error: any) {
      // Handle 401 Unauthorized - token expired or invalid
      if (error.response?.status === 401) {
        clearToken()
        toast.add({
          title: 'Unauthorized',
          description: 'Please log out and log in again.',
          icon: 'i-lucide-shield-alert',
          color: 'error'
        })
        throw createError({
          statusCode: 401,
          statusMessage: 'Session expired. Please log out and log in again.'
        })
      }
      throw error
    }
  }

  return { secureFetch }
}
