export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const query = getQuery(event)

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  // Fallback user ID if session is empty (for iframe access)
  const userId = (session as any).user?.id || querySessionId || 'guest-session'

  return (await useDrizzle().select().from(tables.chats).where(eq(tables.chats.userId, userId))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
})
