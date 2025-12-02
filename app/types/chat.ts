export type ServerMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ServerChat = {
  id: string
  messages: ServerMessage[]
}

