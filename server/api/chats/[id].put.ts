import { resolveChatUserId } from '../../utils/iframe-auth'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)

  const { content, role } = await readBody(event)

  const db = useDrizzle()

  const userId = await resolveChatUserId(event)

  // Verify chat ownership before adding message
  const chat = await db.query.chats.findFirst({
    where: (chat, { eq }) => and(eq(chat.id, id as string), eq(chat.userId, userId))
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  //TODO(emre): Return a proper response to the client showing row id and etc
  await db.insert(tables.messages).values({
    chatId: id,
    role: role,
    content: content
  })
})
