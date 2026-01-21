import { resolveChatUserId } from '../utils/iframe-auth'

export default defineEventHandler(async (event) => {
  const userId = await resolveChatUserId(event)

  return await useDrizzle().query.chats.findMany({
    where: (chat, { eq }) => eq(chat.userId, userId),
    orderBy: (chat, { desc }) => [desc(chat.createdAt)]
  })
})
