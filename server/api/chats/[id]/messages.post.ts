import { and } from 'drizzle-orm'
import * as tables from '../../../database/schema'

export default defineEventHandler(async (event) => {
  console.log('Messages POST endpoint called')

  const query = getQuery(event)
  const { id } = getRouterParams(event)
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

  console.log('Request data:', { chatId: id, body, userId })

  const { id: messageId, role, content } = body
  const db = useDrizzle()

  // Verify chat exists and belongs to user
  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      return and(eq(chat.id, id as string), eq(chat.userId, userId))
    }
  })

  if (!chat) {
    console.log('Chat not found or unauthorized:', id)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  console.log('Chat found, inserting message:', { messageId, chatId: id, role, contentLength: content?.length })

  // Save the message
  const result = await db.insert(tables.messages).values({
    id: messageId,
    chatId: id as string,
    role,
    content
  })

  console.log('Message inserted successfully:', result)
  return { success: true }
})