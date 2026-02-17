import { createError, getHeader, getQuery } from 'h3'
import { captureUpstreamException, captureUpstreamMessage } from '../../../utils/sentry-upstream'

const ROUTE_NAME = '/api/phishing/editor/save'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const query = getQuery(event)

  const baseApiUrl = typeof query.baseApiUrl === 'string'
    ? query.baseApiUrl
    : getHeader(event, 'x-base-api-url')

  const fleetAgentUrl = process.env.FLEET_AGENT_URL
  if (!fleetAgentUrl) {
    captureUpstreamMessage('FLEET_AGENT_URL is not configured', {
      component: 'phishing-editor-upstream',
      route: ROUTE_NAME,
      companyId: getHeader(event, 'x-company-id') || 'unknown',
      fingerprint: ['phishing-editor-upstream', 'misconfiguration', 'fleet-agent-url-missing']
    })
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

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {})
    })
  } catch (error) {
    captureUpstreamException(error, {
      component: 'phishing-editor-upstream',
      route: ROUTE_NAME,
      companyId: companyId || 'unknown',
      fingerprint: ['phishing-editor-upstream', 'fetch-error'],
      tags: {
        errorType: 'fetch'
      },
      extras: { targetUrl }
    })
    throw createError({ statusCode: 502, statusMessage: 'Failed to reach phishing editor upstream' })
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || response.statusText
    captureUpstreamMessage('Phishing editor upstream returned non-OK status', {
      component: 'phishing-editor-upstream',
      route: ROUTE_NAME,
      companyId: companyId || 'unknown',
      fingerprint: ['phishing-editor-upstream', 'http-non-ok', String(response.status)],
      tags: {
        statusCode: response.status
      },
      extras: {
        targetUrl,
        responseBody: payload
      }
    })
    throw createError({ statusCode: response.status, statusMessage: message })
  }

  return payload
})
