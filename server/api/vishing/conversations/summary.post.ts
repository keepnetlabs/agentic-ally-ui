import { createError, getHeader, getQuery, readBody } from 'h3'

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

const SUMMARY_TIMEOUT_MS = 15000

export default defineEventHandler(async (event) => {
  const body = await readBody<SummaryRequestBody>(event)
  const query = getQuery(event)

  const queryBaseApiUrl = typeof query.baseApiUrl === 'string' ? query.baseApiUrl : ''
  const headerBaseApiUrl = getHeader(event, 'x-base-api-url') || ''
  const runtimeConfig = useRuntimeConfig() as any
  const runtimeBaseApiUrl = runtimeConfig?.public?.baseApiUrl || ''
  const baseApiUrl = headerBaseApiUrl || queryBaseApiUrl || runtimeBaseApiUrl

  if (!baseApiUrl) {
    throw createError({ statusCode: 400, statusMessage: 'baseApiUrl is required' })
  }

  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'messages is required' })
  }

  const upstreamUrl = `${baseApiUrl.replace(/\/$/, '')}/vishing/conversations/summary`
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

  let response: Response
  try {
    response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(companyIdHeader ? { 'X-COMPANY-ID': companyIdHeader } : {}),
        ...(tokenHeader ? { 'X-AGENTIC-ALLY-TOKEN': tokenHeader } : {})
      },
      body: JSON.stringify(payload),
      signal: abortController.signal
    })
  } catch (error: any) {
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
    throw createError({
      statusCode: response.status,
      statusMessage: `Summary upstream error (${response.status})`,
      data: responseBody
    })
  }

  return responseBody
})
