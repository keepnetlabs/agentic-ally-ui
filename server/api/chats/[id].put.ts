export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const { id } = getRouterParams(event)

  const { content, role } = await readBody(event)

  const db = useDrizzle()

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
