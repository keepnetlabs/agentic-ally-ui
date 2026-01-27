import { extractCompanyId } from '../../utils/company-id'

const resolveBaseApiUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed === 'https://test-ui.devkeepnet.com') {
    return 'https://test-api.devkeepnet.com'
  }
  return trimmed
}

export default defineEventHandler(async (event) => {
  const { code, baseApiUrl: rawBaseApiUrl } = await readBody(event)

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Code is required'
    })
  }

  if (!rawBaseApiUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'baseApiUrl is required'
    })
  }

  const baseApiUrl = resolveBaseApiUrl(rawBaseApiUrl)

  try {
    // Call external auth API to exchange code for token
    const url = `${baseApiUrl}/api/agent-auth/token`
    console.log('Exchanging code for token at:', url)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*'
      },
      body: JSON.stringify({
        authCode: code
      })
    })

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Failed to get token from auth server: ${response.statusText}`
      })
    }

    const data = await response.json()

    if (!data.accessToken) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No accessToken returned from auth server'
      })
    }

    // Return token to client (client will store in localStorage)
    return {
      accessToken: data.accessToken
    }
  } catch (error: any) {
    console.error('Token exchange error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to exchange code for token'
    })
  }
})
