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

  if (!querySessionId) {
    try {
      const session = await getUserSession(event)
      sessionUserId = (session as any).user?.id
    } catch {
      // Session devre dışı, query'den devam
    }
  }

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > sessionUserId > 'guest-session'
  const userId = querySessionId || sessionUserId || 'guest-session'

  console.log('Request data:', { chatId, messageId, body, userId })

  const { content } = body
  const db = useDrizzle()

  const result = await db
    .select({
      chatId: tables.chats.id,
      message: tables.messages
    })
    .from(tables.chats)
    .leftJoin(
      tables.messages,
      and(
        eq(tables.messages.id, messageId as string),
        eq(tables.messages.chatId, tables.chats.id)
      )
    )
    .where(and(eq(tables.chats.id, chatId as string), eq(tables.chats.userId, userId)))
    .get()

  if (!result) {
    console.log('Chat not found or unauthorized:', chatId)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  if (!result.message) {
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
