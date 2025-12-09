import { parseAIMessage } from '../../utils/text-utils'
import { and } from 'drizzle-orm'
import * as tables from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI.',
    tags: ['ai']
  }
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const query = getQuery(event)

  const { id } = getRouterParams(event)
  // TODO: Use readValidatedBody
  const { modelProvider, model, messages, conversationId } = await readBody(event)

  const db = useDrizzle()

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > session.user.id > 'guest-session'
  const userId = querySessionId || (session as any).user?.id || 'guest-session'

  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      return and(eq(chat.id, id as string), eq(chat.userId, userId))
    },
    with: {
      messages: true
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

  // Proxy the request to the Fleet Agent Worker backend
  console.log('FLEET_AGENT_URL', process.env.FLEET_AGENT_URL)

  try {
    const accessToken = getHeader(event, 'x-agentic-ally-token') || 'eyJhbGciOiJSUzI1NiIsImtpZCI6IkMwMjRCMzYyRUY5QzgzNzQxNjYzMzJGMDE1MjMzQUNDIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjUyMDM5NTQsImV4cCI6MTc2NTI5MDM1NCwiaXNzIjoiaHR0cDovL3Rlc3QtYXBpLmRldmtlZXBuZXQuY29tIiwiY2xpZW50X2lkIjoidWlfY2xpZW50Iiwic3ViIjoicHRhQ2RSS2paRTJhIiwiYXV0aF90aW1lIjoxNzY1MjAzOTU0LCJpZHAiOiJodHRwczovL3Rlc3QtYXBpLmRldmtlZXBuZXQuY29tIiwiZW1haWwiOiJndXJrYW4udWd1cmx1QGtlZXBuZXRsYWJzLmNvbSIsImZhbWlseV9uYW1lIjoiVWd1cmx1IiwiZ2l2ZW5fbmFtZSI6Ikd1cmthbiIsIm5hbWUiOiJHdXJrYW4gVWd1cmx1IiwicGhvbmVfbnVtYmVyIjoiIiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjoiZmFsc2UiLCJ1c2VyX2lkIjoiMzIiLCJ1c2VyX2NvbXBhbnlfaWQiOiIxIiwidXNlcl9jb21wYW55X3Jlc291cmNlaWQiOiJ1QjRqY0Z6OXgxTXkiLCJ1c2VyX2NvbXBhbnlfbmFtZSI6IlN5c3RlbSIsInVzZXJfY29tcGFueV9sb2dvcGF0aCI6Imh0dHBzOi8vdGVzdC1hcGkuZGV2a2VlcG5ldC5jb20vY29tcGFueWxvZ28vZmI5Y2RmODAtYmExZi00MWI4LTkxYzktYjE1YmU4YjBmMDEwLnBuZyIsInVzZXJfY29tcGFueV9pbmR1c3RyeV9yZXNvdXJjZWlkIjoiWlpZR2VOVkI2MHlNIiwidXNlcl9jb21wYW55X2luZHVzdHJ5X25hbWUiOiJUZWNobm9sb2d5IiwidXNlcl9jb21wYW55X3BhcmVudGNvbXBhbnlfcmVzb3VyY2VpZCI6IiIsInVzZXJfY29tcGFueV9wYXJlbnRjb21wYW55X25hbWUiOiIiLCJ1c2VyX2NvbXBhbnlfcGFyZW50Y29tcGFueV9pZCI6IjAiLCJzdGF0dXMiOiIxIiwicm9sZSI6IlJvb3QiLCJyb290X2FjY2VzcyI6IlRydWUiLCJyZXNlbGxlcl9hY2Nlc3MiOiJUcnVlIiwiY29tcGFueV9hZG1pbl9hY2Nlc3MiOiJUcnVlIiwianRpIjoiOTlENDI4OEE4RDhBRUYzNjU3MUE3NDM5NTQ3NjkxNEIiLCJpYXQiOjE3NjUyMDM5NTQsInNjb3BlIjpbImFwaTEiXSwiYW1yIjpbInBhc3N3b3JkIl19.vqoZHBv6cOBrLQOEuDkGANSpnSMnb4ys0b5-6omfRZ56aOGwRpo6seV-789QwsWGU1SxroVFENFFdWd2h56HV6tNxs9btp2RCspENcr51owM3hoasIDMm4zL5OcAWlNVA-AD_6yC3TuMKpGg-j9L6yyavIxgNWMdn7j9-w8WuUEWobWLRpVBnj8Td7hxxeaMdgAvtOLBRk4BQXWV2KbddLIpAAAeQwYAT9XhCwZjIDhvT7QOs6cidS7iaWp7M4P3R7lMIfdiOiDbXqha1iYVOl8Hx2ejiY98MQQJELNTmfqQknWMrVkPNQxBf2YnVj5BF_GXnamTsKfyxAJO1o1qQw'
    console.log('accessToken', accessToken)
    const response = await fetch(process.env.FLEET_AGENT_URL!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { 'X-AGENTIC-ALLY-TOKEN': accessToken } : {})
      },
      body: JSON.stringify({ modelProvider, model, messages, conversationId })
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
  } catch (error) {
    console.error('Fleet Agent fetch error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to connect to Fleet Agent'
    })
  }
})
