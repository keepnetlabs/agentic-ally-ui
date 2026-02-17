import { createError, getHeader, getQuery, readBody } from 'h3'
import { captureUpstreamException, captureUpstreamMessage } from '../../../utils/sentry-upstream'

type SummaryRequestMessage = {
  role: string
  text?: string
  content?: string
  timestamp?: number
}

type SummaryRequestBody = {
  accessToken?: string
  conversationId?: string
  messages?: SummaryRequestMessage[]
}

const SUMMARY_TIMEOUT_MS = 90000
const ROUTE_NAME = '/api/vishing/conversations/summary'

const resolveBaseApiUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed === 'https://test-ui.devkeepnet.com') {
    return 'https://test-api.devkeepnet.com'
  }
  return trimmed
}

const tryParseUrl = (value?: string) => {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SummaryRequestBody>(event)
  const query = getQuery(event)

  const queryBaseApiUrl = typeof query.baseApiUrl === 'string' ? query.baseApiUrl : ''
  const headerBaseApiUrl = getHeader(event, 'x-base-api-url') || ''
  const runtimeConfig = useRuntimeConfig() as any
  const runtimeBaseApiUrl = runtimeConfig?.public?.baseApiUrl || ''
  const rawBaseApiUrl = headerBaseApiUrl || queryBaseApiUrl || runtimeBaseApiUrl
  const requestedBaseApiUrl = rawBaseApiUrl ? resolveBaseApiUrl(rawBaseApiUrl) : ''
  const fleetAgentUrl = process.env.FLEET_AGENT_URL || ''
  const fleetParsed = tryParseUrl(fleetAgentUrl)
  if (!fleetParsed) {
    captureUpstreamMessage('FLEET_AGENT_URL is not configured', {
      component: 'vishing-summary-upstream',
      route: ROUTE_NAME,
      companyId: getHeader(event, 'x-company-id') || 'unknown',
      fingerprint: ['vishing-summary-upstream', 'misconfiguration', 'fleet-agent-url-missing']
    })
    throw createError({ statusCode: 500, statusMessage: 'FLEET_AGENT_URL is not configured' })
  }

  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'messages is required' })
  }

  const normalizedBase = fleetParsed.origin.replace(/\/$/, '')
  const upstreamUrl = `${normalizedBase}/vishing/conversations/summary`
  const tokenHeader = getHeader(event, 'x-agentic-ally-token') || ''
  const companyIdHeader = getHeader(event, 'x-company-id') || ''
  const normalizedMessages = (body.messages || []).map((message) => ({
    role: message.role,
    text: message.text ?? message.content ?? '',
    timestamp: message.timestamp
  }))

  const payload = {
    ...body,
    messages: normalizedMessages,
    accessToken: body?.accessToken || tokenHeader || undefined
  }
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), SUMMARY_TIMEOUT_MS)

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(companyIdHeader ? { 'X-COMPANY-ID': companyIdHeader } : {}),
    ...(tokenHeader ? { 'X-AGENTIC-ALLY-TOKEN': tokenHeader } : {}),
    ...(requestedBaseApiUrl ? { 'X-BASE-API-URL': requestedBaseApiUrl } : {})
  }

  const postSummary = async (url: string) => {
    return await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(payload),
      signal: abortController.signal
    })
  }

  let response: Response
  try {
    response = await postSummary(upstreamUrl)
  } catch (error: any) {
    const isAbort = error?.name === 'AbortError'
    captureUpstreamException(error, {
      component: 'vishing-summary-upstream',
      route: ROUTE_NAME,
      companyId: companyIdHeader || 'unknown',
      fingerprint: ['vishing-summary-upstream', isAbort ? 'timeout' : 'fetch-error'],
      tags: {
        errorType: isAbort ? 'timeout' : 'fetch'
      },
      extras: {
        upstreamUrl,
        conversationId: body?.conversationId || null
      }
    })
    if (error?.name === 'AbortError') {
      throw createError({ statusCode: 504, statusMessage: 'Summary request timed out' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Failed to reach summary upstream' })
  } finally {
    clearTimeout(timeout)
  }

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const responseBody = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    captureUpstreamMessage('Vishing summary upstream returned non-OK status', {
      component: 'vishing-summary-upstream',
      route: ROUTE_NAME,
      companyId: companyIdHeader || 'unknown',
      fingerprint: ['vishing-summary-upstream', 'http-non-ok', String(response.status)],
      tags: {
        statusCode: response.status
      },
      extras: {
        upstreamUrl,
        conversationId: body?.conversationId || null,
        responseBody
      }
    })
    throw createError({
      statusCode: response.status,
      statusMessage: `Summary upstream error (${response.status})`,
      data: responseBody
    })
  }

  return responseBody
})
