export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  // Fallback user ID if session is empty (for iframe access)
  const userId = (session as any).user?.id || session?.id || 'guest-session'

  return (await useDrizzle().select().from(tables.chats).where(eq(tables.chats.userId, userId))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
})
