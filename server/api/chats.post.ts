export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const query = getQuery(event)

  const { prompt } = await readBody(event)
  const db = useDrizzle()

  // Get sessionId from URL query parameter (for iframe usage)
  const querySessionId = query.sessionId as string

  // Fallback user ID if session is empty (for iframe access)
  // Priority: querySessionId > session.user.id > 'guest-session'
  const userId = querySessionId || (session as any).user?.id || 'guest-session'

  // Create a new chat with the first user message
  const chat = await db.insert(tables.chats).values({
    title: prompt.substring(0, 100),
    userId: userId
  }).returning().get()

  //TODO: Improve this to support other content types such as images, files, etc.
  // Add the first user message (prompt) to messages table
  await db.insert(tables.messages).values({
    chatId: chat.id,
    role: 'user',
    content: prompt
  })

  return chat
})
