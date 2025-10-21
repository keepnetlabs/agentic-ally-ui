export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  const { id } = getRouterParams(event)

  const { content, role } = await readBody(event)

  const db = useDrizzle()

  //TODO(emre): Return a proper response to the client showing row id and etc
  await db.insert(tables.messages).values({
    chatId: id,
    role: role,
    content: content
  })
})
