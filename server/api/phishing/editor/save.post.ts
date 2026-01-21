import { createError, getHeader, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const query = getQuery(event)

  const baseApiUrl = typeof query.baseApiUrl === 'string'
    ? query.baseApiUrl
    : getHeader(event, 'x-base-api-url')

  const fleetAgentUrl = process.env.FLEET_AGENT_URL
  if (!fleetAgentUrl) {
    throw createError({ statusCode: 500, statusMessage: 'FLEET_AGENT_URL is not configured' })
  }

  const authHeader = getHeader(event, 'authorization')
  const tokenHeader = getHeader(event, 'x-agentic-ally-token')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined
  const companyId = getHeader(event, 'x-company-id') || (typeof query.companyId === 'string' ? query.companyId : undefined)

  const headers: Record<string, string> = {
    'content-type': 'application/json'
  }

  if (authHeader) {
    headers.Authorization = authHeader
  }

  if (tokenHeader) {
    headers['X-AGENTIC-ALLY-TOKEN'] = tokenHeader
  } else if (bearerToken) {
    headers['X-AGENTIC-ALLY-TOKEN'] = bearerToken
  }

  if (companyId) {
    headers['X-COMPANY-ID'] = companyId
  }

  if (baseApiUrl) {
    headers['X-BASE-API-URL'] = baseApiUrl
  }

  const targetUrl = `${fleetAgentUrl.replace('/chat', '')}/phishing/editor/save`
  console.log('Phishing editor save target:', targetUrl)
  console.log('Phishing editor save headers:', {
    hasAuthorization: Boolean(authHeader),
    hasAgenticToken: Boolean(tokenHeader || bearerToken),
    hasCompanyId: Boolean(companyId),
    hasBaseApiUrl: Boolean(baseApiUrl)
  })

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {})
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || response.statusText
    throw createError({ statusCode: response.status, statusMessage: message })
  }

  return payload
})
