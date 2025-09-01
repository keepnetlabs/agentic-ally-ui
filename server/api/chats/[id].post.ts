import { parseAIMessage } from '../../utils/text-utils'

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
  const response = await fetch(process.env.FLEET_AGENT_URL!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model, messages })
  })

  return response
})
