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

  const { id } = getRouterParams(event)
  // TODO: Use readValidatedBody
  const { model, messages } = await readBody(event)

  const db = useDrizzle()

  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      const userId = (session as any).user?.id || session.id
      return and(eq(chat.id, id as string), eq(chat.userId, userId))
    },
    with: {
      messages: true
    }
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

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
    const response = await fetch(process.env.FLEET_AGENT_URL!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ model, messages })
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
                if (obj.type.startsWith('workflow-')) {
                  // drop this line and the following blank separator
                  skipNextBlank = true
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
      .pipeThrough(new TextDecoderStream())
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
