import { resolveChatUserId } from '../../utils/iframe-auth'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)

  const db = useDrizzle()

  const userId = await resolveChatUserId(event)

  const result = await db.delete(tables.chats)
    .where(and(eq(tables.chats.id, id as string), eq(tables.chats.userId, userId)))
    .returning()

  if (!result.length) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  return result
})
