export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  const { prompt } = await readBody(event)
  const db = useDrizzle()

  // Fallback user ID if session is empty (for iframe access)
  const userId = (session as any).user?.id || session?.id || `guest-${Date.now()}`

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
