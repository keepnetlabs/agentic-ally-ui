import { createError, getHeader, getQuery } from 'h3'
import { captureUpstreamException, captureUpstreamMessage } from '../../../utils/sentry-upstream'

const ROUTE_NAME = '/api/smishing/editor/save'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const query = getQuery(event)

  const baseApiUrl = typeof query.baseApiUrl === 'string'
    ? query.baseApiUrl
    : getHeader(event, 'x-base-api-url')

  const fleetAgentUrl = process.env.FLEET_AGENT_URL
  if (!fleetAgentUrl) {
    captureUpstreamMessage('FLEET_AGENT_URL is not configured', {
      component: 'smishing-editor-upstream',
      route: ROUTE_NAME,
      companyId: getHeader(event, 'x-company-id') || 'unknown',
      fingerprint: ['smishing-editor-upstream', 'misconfiguration', 'fleet-agent-url-missing']
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

  const targetUrl = `${fleetAgentUrl.replace('/chat', '')}/smishing/editor/save`

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {})
    })
  } catch (error) {
    captureUpstreamException(error, {
      component: 'smishing-editor-upstream',
      route: ROUTE_NAME,
      companyId: companyId || 'unknown',
      fingerprint: ['smishing-editor-upstream', 'fetch-error'],
      tags: {
        errorType: 'fetch'
      },
      extras: { targetUrl }
    })
    throw createError({ statusCode: 502, statusMessage: 'Failed to reach smishing editor upstream' })
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || response.statusText
    captureUpstreamMessage('Smishing editor upstream returned non-OK status', {
      component: 'smishing-editor-upstream',
      route: ROUTE_NAME,
      companyId: companyId || 'unknown',
      fingerprint: ['smishing-editor-upstream', 'http-non-ok', String(response.status)],
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
