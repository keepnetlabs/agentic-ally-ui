import { computed } from 'vue'
import { useAuthToken } from './useAuthToken'
import { useRouteParams } from './useRouteParams'

export const useApiHeaders = () => {
  const { token: accessToken } = useAuthToken()
  const { companyId, baseApiUrl } = useRouteParams()

  const apiHeaders = computed(() => ({
    ...(accessToken.value ? { 'X-AGENTIC-ALLY-TOKEN': accessToken.value } : {}),
    ...(companyId.value ? { 'X-COMPANY-ID': companyId.value } : {}),
    ...(baseApiUrl.value ? { 'X-BASE-API-URL': baseApiUrl.value } : {})
  }))

  return { apiHeaders }
}
