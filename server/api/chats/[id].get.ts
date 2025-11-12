export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const query = getQuery(event)

  const { id } = getRouterParams(event)

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > session.user.id > 'guest-session'
  const userId = querySessionId || (session as any).user?.id || 'guest-session'

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
