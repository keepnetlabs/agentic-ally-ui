import { computed } from 'vue'
import { useRoute } from 'vue-router'

export const useRouteParams = () => {
  const route = useRoute()

  // Individual query params
  const sessionId = computed(() => route.query.sessionId as string)
  const accessToken = computed(() => route.query.accessToken as string)
  const baseApiUrl = computed(() => route.query.baseApiUrl as string)
  const companyId = computed(() => route.query.companyId as string)

  // Extract all relevant query params
  const queryParams = computed(() => {
    const params = new URLSearchParams()

    if (sessionId.value) params.append('sessionId', sessionId.value)
    if (accessToken.value) params.append('accessToken', accessToken.value)
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
    queryParams,
    buildUrl
  }
}
