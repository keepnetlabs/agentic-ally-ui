import { parseAIMessage } from '../../utils/text-utils'
import { and } from 'drizzle-orm'
import * as tables from '../../database/schema'
import { extractCompanyId } from '../../utils/company-id'
import { resolveChatUserId } from '../../utils/iframe-auth'
import { captureUpstreamException, captureUpstreamMessage } from '../../utils/sentry-upstream'

const ROUTE_NAME = '/api/chats/[id]'

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI.',
    tags: ['ai']
  }
})

const cleanMetadata = (obj: any) => {
  const metadataPattern = /::ui:training_meta::[\s\S]*?:\/ui:training_meta::/g
  // Hide specific UI signals (handles both single tags and wrapped content)
  const signalsPattern = /::ui:(training_uploaded|phishing_uploaded|training_assigned|phishing_assigned|target_user|target_group)::([\s\S]*?::\/ui:\1::)?(\n|\s)*/g

  if (obj.text) {
    obj.text = obj.text.replace(metadataPattern, '').replace(signalsPattern, '')
  }
  if (obj.delta) {
    obj.delta = obj.delta.replace(metadataPattern, '').replace(signalsPattern, '')
  }
  return obj
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const chatId = id as string
  // TODO: Use readValidatedBody
  const { modelProvider, model, messages, conversationId } = await readBody(event)

  const db = useDrizzle()
  const userId = await resolveChatUserId(event)

  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      return and(eq(chat.id, chatId), eq(chat.userId, userId))
    }
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  // Save user message if this is a new message
  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role === 'user' && messages.length > 1) {
    await db.insert(tables.messages).values({
      chatId,
      role: 'user',
      content: parseAIMessage(lastMessage)
    })
  }

  // Fetch policy URLs for company context
  const companyId = extractCompanyId(event) || getHeader(event, 'x-company-id')
  const baseApiUrl = getHeader(event, 'x-base-api-url')
  let policyUrls: string[] = []

  if (companyId) {
    try {
      const policies = await db.query.policies.findMany({
        where: (policy, { eq }) => eq(policy.companyId, companyId),
        columns: {
          blobUrl: true
        }
      })
      // Build full URLs for R2 file access
      // If blobUrl is a pathname, prepend the base URL
      policyUrls = policies.map(policy => {
        if (policy.blobUrl.startsWith('http')) {
          return policy.blobUrl
        }
        // Construct full URL for R2 file serving
        const baseUrl = getRequestURL(event).origin
        return `${baseUrl}/api/policies/${encodeURIComponent(policy.blobUrl)}`
      })
    } catch (error) {
      console.error('Failed to fetch policies:', error)
      // Continue without policies if fetch fails
    }
  }

  // Proxy the request to the Fleet Agent Worker backend
  const fleetAgentUrl = process.env.FLEET_AGENT_URL
  console.log('FLEET_AGENT_URL configured:', Boolean(fleetAgentUrl))
  if (!fleetAgentUrl) {
    captureUpstreamMessage('FLEET_AGENT_URL is not configured', {
      component: 'chat-upstream',
      route: ROUTE_NAME,
      companyId,
      userId,
      fingerprint: ['chat-upstream', 'misconfiguration', 'fleet-agent-url-missing'],
      extras: { chatId }
    })
    throw createError({
      statusCode: 500,
      statusMessage: 'Fleet Agent URL is not configured'
    })
  }

  try {
    const config = useRuntimeConfig()
    const accessToken = getHeader(event, 'x-agentic-ally-token') || config.viteDefaultToken || ''
    console.log('Fleet Agent request context:', {
      hasAccessToken: Boolean(accessToken),
      hasCompanyId: Boolean(companyId),
      hasBaseApiUrl: Boolean(baseApiUrl),
      policyUrlsCount: policyUrls.length,
      modelProvider: String(modelProvider || 'unknown'),
      model: String(model || 'unknown')
    })
    const response = await fetch(fleetAgentUrl!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { 'X-AGENTIC-ALLY-TOKEN': accessToken } : {}),
        ...(companyId ? { 'X-COMPANY-ID': companyId } : {}),
        ...(baseApiUrl ? { 'X-BASE-API-URL': baseApiUrl } : {})
      },
      body: JSON.stringify({ modelProvider, model, messages, conversationId, policyUrls })
    })

    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      console.error('Fleet Agent upstream returned non-OK status:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      })
      captureUpstreamMessage('Fleet Agent upstream returned non-OK status', {
        component: 'chat-upstream',
        route: ROUTE_NAME,
        companyId,
        userId,
        fingerprint: ['chat-upstream', 'http-non-ok', String(response.status)],
        tags: {
          statusCode: response.status,
          modelProvider: String(modelProvider || 'unknown'),
          model: String(model || 'unknown')
        },
        extras: {
          chatId,
          upstreamStatus: response.status,
          upstreamStatusText: response.statusText,
          responseBody: responseText,
          conversationId: conversationId || null
        }
      })
      throw createError({
        statusCode: response.status,
        statusMessage: `Fleet Agent error: ${response.statusText}`
      })
    }

    // Properly proxy the SSE stream response
    setHeader(event, 'Content-Type', response.headers.get('content-type') || 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')

    // Copy important headers from Fleet Agent response
    const importantHeaders = ['x-vercel-ai-ui-message-stream', 'access-control-allow-origin']
    importantHeaders.forEach(headerName => {
      const headerValue = response.headers.get(headerName)
      if (headerValue) {
        setHeader(event, headerName, headerValue)
      }
    })

    // Filter out unsupported events (e.g., workflow-* events) that the UI client does not recognize.
    // We operate on SSE lines and drop any `data: { type: "workflow-*" }` entries.
    const upstream = response.body as ReadableStream<Uint8Array> | null

    if (!upstream) {
      return send(event, '')
    }

    let buffer = ''
    let skipNextBlank = false
    let lastTextId = ''
    let lastReasoningId = ''

    const transform = new TransformStream<string, string>({
      transform(chunk, controller) {
        buffer += chunk
        let newlineIndex = buffer.indexOf('\n')
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex + 1) // include newline
          buffer = buffer.slice(newlineIndex + 1)

          const trimmed = line.trim()

          if (skipNextBlank) {
            if (trimmed === '') {
              // skip the separator after a dropped event
              skipNextBlank = false
              newlineIndex = buffer.indexOf('\n')
              continue
            }
            // if not blank, clear flag and continue normal processing
            skipNextBlank = false
          }

          if (trimmed.startsWith('data: ')) {
            const jsonText = trimmed.slice('data: '.length)
            try {
              const obj = JSON.parse(jsonText)
              // Log ALL incoming events to debug
              console.log('[SSE] Incoming event type:', obj?.type)
              if (obj && typeof obj === 'object' && typeof obj.type === 'string') {
                // Clean metadata from content
                cleanMetadata(obj)

                // === MASTRA V1: Convert data-ui-signal to text-delta for database persistence ===
                // This ensures UI signals are saved to database and work after page refresh
                if (obj.type === 'data-ui-signal') {
                  console.log('[data-ui-signal] Original:', JSON.stringify(obj))
                  if (obj.data?.message) {
                    // LLM doesn't send text-start anymore, so we need full text lifecycle
                    // Each UI signal gets its own text-start -> text-delta -> text-end
                    const uiTextId = `ui-text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

                    // 1. text-start (SSE format: data: {...}\n\n)
                    const textStart = { type: 'text-start', id: uiTextId }
                    console.log('[data-ui-signal] Sending text-start:', JSON.stringify(textStart))
                    controller.enqueue('data: ' + JSON.stringify(textStart) + '\n\n')

                    // 2. text-delta
                    const textDelta = { type: 'text-delta', id: uiTextId, delta: obj.data.message }
                    console.log('[data-ui-signal] Sending text-delta:', JSON.stringify(textDelta))
                    controller.enqueue('data: ' + JSON.stringify(textDelta) + '\n\n')

                    // 3. text-end
                    const textEnd = { type: 'text-end', id: uiTextId }
                    console.log('[data-ui-signal] Sending text-end:', JSON.stringify(textEnd))
                    controller.enqueue('data: ' + JSON.stringify(textEnd) + '\n\n')
                  } else {
                    console.log('[data-ui-signal] No data.message, passing as-is')
                    controller.enqueue(line)
                  }
                  newlineIndex = buffer.indexOf('\n')
                  continue
                }

                // === MASTRA V1: Convert data-reasoning to legacy reasoning-* format ===
                // Mastra sends: { type: "data-reasoning", data: { event: "start"|"delta"|"end", id, text } }
                // SDK expects:  { type: "reasoning-start|delta|end", id, text }
                if (obj.type === 'data-reasoning' && obj.data) {
                  const { event, id, text } = obj.data
                  console.log('[data-reasoning] Original:', JSON.stringify(obj))

                  // Track reasoning ID
                  if (event === 'start') {
                    lastReasoningId = id || `reasoning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                  }
                  const reasoningId = id || lastReasoningId || `reasoning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

                  let legacyEvent: any = null
                  if (event === 'start') {
                    legacyEvent = { type: 'reasoning-start', id: reasoningId }
                  } else if (event === 'delta' && text) {
                    // SDK expects 'delta' field, not 'text'
                    legacyEvent = { type: 'reasoning-delta', id: reasoningId, delta: text }
                  } else if (event === 'end') {
                    legacyEvent = { type: 'reasoning-end', id: reasoningId }
                  }

                  if (legacyEvent) {
                    console.log('[data-reasoning] Converted:', JSON.stringify(legacyEvent))
                    controller.enqueue('data: ' + JSON.stringify(legacyEvent) + '\n\n')
                  }
                  newlineIndex = buffer.indexOf('\n')
                  continue
                }

                // Pass through other data-* events (data-tool-progress, etc.)
                if (obj.type.startsWith('data-')) {
                  controller.enqueue(line)
                  newlineIndex = buffer.indexOf('\n')
                  continue
                }

                // Generate unique ID for text-start events if missing
                if ((obj.type === 'text-start' || obj.type === 'text-delta' || obj.type === 'text-end') && !obj.id) {
                  if (obj.type === 'text-start') {
                    lastTextId = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    obj.id = lastTextId
                    console.warn('Generated missing id for text-start event:', obj.id)
                  } else if (lastTextId) {
                    // Reuse the last text-start ID for delta and end events
                    obj.id = lastTextId
                  }
                }

                // Generate unique ID for reasoning events if missing (legacy format)
                if ((obj.type === 'reasoning-start' || obj.type === 'reasoning-delta' || obj.type === 'reasoning-end') && !obj.id) {
                  if (obj.type === 'reasoning-start') {
                    lastReasoningId = `reasoning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    obj.id = lastReasoningId
                    console.warn('Generated missing id for reasoning-start event:', obj.id)
                  } else if (lastReasoningId) {
                    // Reuse the last reasoning-start ID for delta and end events
                    obj.id = lastReasoningId
                  }
                }

                if (obj.type.startsWith('workflow-')) {
                  // drop this line and the following blank separator
                  skipNextBlank = true
                  newlineIndex = buffer.indexOf('\n')
                  continue
                }

                // Re-encode the object if we modified it
                const isTextEvent = obj.type === 'text-start' || obj.type === 'text-delta' || obj.type === 'text-end'
                const isReasoningEvent = obj.type === 'reasoning-start' || obj.type === 'reasoning-delta' || obj.type === 'reasoning-end'

                if ((isTextEvent || isReasoningEvent) && obj.id && !jsonText.includes(obj.id)) {
                  const modifiedLine = 'data: ' + JSON.stringify(obj) + '\n'
                  controller.enqueue(modifiedLine)
                  newlineIndex = buffer.indexOf('\n')
                  continue
                }
              }
            } catch (_) {
              // not json or partial line; pass through
            }
          }

          controller.enqueue(line)
          newlineIndex = buffer.indexOf('\n')
        }
      },
      flush(controller) {
        if (buffer.length > 0) {
          controller.enqueue(buffer)
          buffer = ''
        }
      }
    })

    const encoded = upstream
      .pipeThrough(new TextDecoderStream() as any)
      .pipeThrough(transform)
      .pipeThrough(new TextEncoderStream())

    return sendStream(event, encoded)
  } catch (error: any) {
    console.error('Fleet Agent fetch error:', error)
    const statusCode = error?.statusCode ? String(error.statusCode) : 'none'
    const errorName = error?.name ? String(error.name) : 'Error'
    captureUpstreamException(error, {
      component: 'chat-upstream',
      route: ROUTE_NAME,
      companyId,
      userId,
      fingerprint: ['chat-upstream', 'fetch-exception', errorName, statusCode],
      tags: {
        statusCode,
        errorName,
        modelProvider: String(modelProvider || 'unknown')
      },
      extras: {
        chatId,
        hasCompanyId: Boolean(companyId),
        hasBaseApiUrl: Boolean(baseApiUrl),
        conversationId: conversationId || null
      }
    })

    // Propagate existing H3 errors (including the one we threw above for !response.ok)
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to connect to Fleet Agent'
    })
  }
})
