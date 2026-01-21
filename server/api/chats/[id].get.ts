import { resolveChatUserId } from '../../utils/iframe-auth'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const userId = await resolveChatUserId(event)

  const chat = await useDrizzle().query.chats.findFirst({
    where: (chat, { eq }) => and(eq(chat.id, id as string), eq(chat.userId, userId)),
    with: {
      messages: true
    }
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  return chat
})
