export type ServerMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ServerChat = {
  id: string
  messages: ServerMessage[]
}

export interface LandingPage {
  name: string
  description: string
  method: 'Click-Only' | 'Data-Submission'
  difficulty: 'Easy' | 'Medium' | 'Hard'
  simulationLink: string
  pages: Array<{
    type: 'login' | 'success' | 'info'
    template: string // HTML string
  }>
}

export interface PhishingEmail {
  subject: string
  template: string
  fromAddress: string
  fromName: string
  method: 'Click-Only' | 'Data-Submission'
}

