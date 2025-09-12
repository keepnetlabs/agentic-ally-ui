import { and } from 'drizzle-orm'
import * as tables from '../../../database/schema'

export default defineEventHandler(async (event) => {
  console.log('Messages POST endpoint called')
  
  const session = await getUserSession(event)
  const { id } = getRouterParams(event)
  const body = await readBody(event)
  
  console.log('Request data:', { chatId: id, body, userId: (session as any).user?.id || session.id })
  
  const { id: messageId, role, content } = body
  const db = useDrizzle()

  // Verify chat exists and belongs to user
  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => {
      const userId = (session as any).user?.id || session.id
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