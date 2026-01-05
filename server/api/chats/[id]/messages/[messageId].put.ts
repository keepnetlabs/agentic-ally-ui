import { and, eq } from 'drizzle-orm'
import * as tables from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  console.log('Message PUT endpoint called')

  const query = getQuery(event)
  const { id: chatId, messageId } = getRouterParams(event)
  const body = await readBody(event)

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  let sessionUserId: string | undefined

  try {
    const session = await getUserSession(event)
    sessionUserId = (session as any).user?.id
  } catch {
    // Session devre dışı, query'den devam
  }

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > sessionUserId > 'guest-session'
  const userId = querySessionId || sessionUserId || 'guest-session'

  console.log('Request data:', { chatId, messageId, body, userId })

  const { content } = body
  const db = useDrizzle()

  // Verify chat exists and belongs to user
  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      return and(eq(chat.id, chatId as string), eq(chat.userId, userId))
    }
  })

  if (!chat) {
    console.log('Chat not found or unauthorized:', chatId)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  // Verify message exists and belongs to this chat
  const message = await db.query.messages.findFirst({
    where: (message, { eq }) => {
      return and(eq(message.id, messageId as string), eq(message.chatId, chatId as string))
    }
  })

  if (!message) {
    console.log('Message not found or unauthorized:', messageId)
    throw createError({ statusCode: 404, statusMessage: 'Message not found' })
  }

  console.log('Message found, updating content:', { messageId, chatId, contentLength: content?.length })

  // Update the message content
  await db.update(tables.messages)
    .set({ content })
    .where(eq(tables.messages.id, messageId as string))

  console.log('Message updated successfully')
  return { success: true }
})
