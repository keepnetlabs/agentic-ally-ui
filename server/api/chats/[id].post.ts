import { parseAIMessage } from '../../utils/text-utils'
import { and } from 'drizzle-orm'
import * as tables from '../../database/schema'
import { extractCompanyId } from '../../utils/company-id'
import { resolveChatUserId } from '../../utils/iframe-auth'

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
  // TODO: Use readValidatedBody
  const { modelProvider, model, messages, conversationId } = await readBody(event)

  const db = useDrizzle()
  const userId = await resolveChatUserId(event)

  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      return and(eq(chat.id, id as string), eq(chat.userId, userId))
    }
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  // Save user message if this is a new message
  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role === 'user' && messages.length > 1) {
    await db.insert(tables.messages).values({
      chatId: id as string,
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
  console.log('FLEET_AGENT_URL', process.env.FLEET_AGENT_URL)

  try {
    const config = useRuntimeConfig()
    const accessToken = getHeader(event, 'x-agentic-ally-token') || config.viteDefaultToken || ''
    console.log('accessToken', accessToken)
    console.log('companyId', companyId)
    console.log('baseApiUrl', baseApiUrl)
    console.log('policyUrls', policyUrls)
    const response = await fetch(process.env.FLEET_AGENT_URL!, {
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
      console.error('Fleet Agent response error:', response.status, response.statusText)
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
              if (obj && typeof obj === 'object' && typeof obj.type === 'string') {
                // Clean metadata from content
                cleanMetadata(obj)
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

                // Generate unique ID for reasoning events if missing
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
