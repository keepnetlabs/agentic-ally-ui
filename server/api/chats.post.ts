import { resolveChatUserId } from '../utils/iframe-auth'

export default defineEventHandler(async (event) => {
  const { prompt } = await readBody(event)
  const db = useDrizzle()

  const userId = await resolveChatUserId(event)

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
