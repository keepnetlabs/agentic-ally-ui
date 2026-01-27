import { useAuthToken } from './useAuthToken'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const useAuthTokenExchange = () => {
  const { setToken, clearToken } = useAuthToken()

  const exchangeAuthToken = async (code: string, baseApiUrl: string) => {
    const attemptExchange = async () => {
      return $fetch('/api/auth/token', {
        method: 'POST',
        body: {
          code,
          baseApiUrl
        }
      })
    }

    try {
      let response = await attemptExchange()
      if (!response?.accessToken) {
        await delay(500)
        response = await attemptExchange()
      }

      if (response && response.accessToken) {
        try {
          setToken(response.accessToken)
        } catch (storageError) {
          console.warn('localStorage not available in this context', storageError)
        }
        return true
      }

      clearToken()
      return false
    } catch (error) {
      console.error('Token exchange failed:', error)
      clearToken()
      return false
    }
  }

  return {
    exchangeAuthToken
  }
}
