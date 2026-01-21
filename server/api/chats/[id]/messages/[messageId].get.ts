import { and, eq } from 'drizzle-orm'
import * as tables from '../../../../database/schema'
import { resolveChatUserId } from '../../../../utils/iframe-auth'

export default defineEventHandler(async (event) => {
  console.log('Message GET endpoint called')
  const { id: chatId, messageId } = getRouterParams(event)
  const userId = await resolveChatUserId(event)

  console.log('Request data:', { chatId, messageId, userId })

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
    console.log('Message not found:', messageId)
    throw createError({ statusCode: 404, statusMessage: 'Message not found' })
  }

  console.log('Message retrieved successfully')
  return result.message
})
