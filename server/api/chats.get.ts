export default defineEventHandler(async (event) => {
  const query = getQuery(event)

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

  return await useDrizzle().query.chats.findMany({
    where: (chat, { eq }) => eq(chat.userId, userId),
    orderBy: (chat, { desc }) => [desc(chat.createdAt)]
  })
})
