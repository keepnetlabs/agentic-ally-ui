import { computed } from 'vue'
import { useRoute } from 'vue-router'

export const useRouteParams = () => {
  const route = useRoute()

  // Individual query params
  const sessionId = computed(() => route.query.sessionId as string)
  const accessToken = computed(() => route.query.accessToken as string)
  const baseApiUrl = computed(() => {
    if (process.client) {
      const hostname = window.location.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:4111'
      }
    }
    const value = route.query.baseApiUrl as string
    if (value) {
      return value
    }
    return ''
  })
  const companyId = computed(() => route.query.companyId as string)
  const code = computed(() => route.query.code as string)

  // Extract all relevant query params (accessToken NOT included, use localStorage instead)
  const queryParams = computed(() => {
    const params = new URLSearchParams()

    if (sessionId.value) params.append('sessionId', sessionId.value)
    // accessToken not included here - use localStorage via useAuthToken instead
    if (baseApiUrl.value) params.append('baseApiUrl', baseApiUrl.value)
    if (companyId.value) params.append('companyId', companyId.value)

    return params.toString()
  })

  // Build URL with query params
  const buildUrl = (path: string) => {
    const queryString = queryParams.value
    return `${path}${queryString ? '?' + queryString : ''}`
  }

  return {
    sessionId,
    accessToken,
    baseApiUrl,
    companyId,
    code,
    queryParams,
    buildUrl
  }
}
