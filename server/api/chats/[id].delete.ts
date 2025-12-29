export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const { id } = getRouterParams(event)

  const db = useDrizzle()

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  let sessionUserId: string | undefined

  try {
    const session = await getUserSession(event)
    sessionUserId = (session as any).user?.id
  } catch {
    // Session devre dışı, query'den devam
  }

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > sessionUserId > 'guest-session'
  const userId = querySessionId || sessionUserId || 'guest-session'

  return await db.delete(tables.chats)
    .where(and(eq(tables.chats.id, id as string), eq(tables.chats.userId, userId)))
    .returning()
})
