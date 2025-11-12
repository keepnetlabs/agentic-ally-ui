export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const query = getQuery(event)

  const { id } = getRouterParams(event)

  const db = useDrizzle()

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > session.user.id > 'guest-session'
  const userId = querySessionId || (session as any).user?.id || 'guest-session'

  return await db.delete(tables.chats)
    .where(and(eq(tables.chats.id, id as string), eq(tables.chats.userId, userId)))
    .returning()
})
