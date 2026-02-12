import { and, eq, sql } from 'drizzle-orm'
import { createError, getQuery } from 'h3'
import * as tables from '../../../database/schema'
import { resolveChatUserId } from '../../../utils/iframe-auth'

type ElevenLabsTranscriptEntry = {
  role?: string
  message?: string
  time_in_call_secs?: number
}

type ElevenLabsConversationResponse = {
  status?: string
  hasAudio?: boolean
  has_audio?: boolean
  recordingUrl?: string
  recording_url?: string
  audioUrl?: string
  audio_url?: string
  metadata?: {
    call_duration_secs?: number
    hasAudio?: boolean
    has_audio?: boolean
    recordingUrl?: string
    recording_url?: string
    audioUrl?: string
    audio_url?: string
  }
  media?: {
    recordingUrl?: string
    recording_url?: string
    audioUrl?: string
    audio_url?: string
  }
  transcript?: ElevenLabsTranscriptEntry[]
}

const ELEVENLABS_TIMEOUT_MS = 10000
const CONVERSATION_ID_PATTERN = /^conv_[A-Za-z0-9_-]{6,128}$/

const escapeLikePattern = (input: string) =>
  input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

export default defineEventHandler(async (event) => {
  const userId = await resolveChatUserId(event)

  const { conversationId } = getRouterParams(event)
  if (!conversationId) {
    throw createError({ statusCode: 400, statusMessage: 'conversationId is required' })
  }
  if (!CONVERSATION_ID_PATTERN.test(conversationId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid conversationId format' })
  }
  const query = getQuery(event)
  const chatId = typeof query.chatId === 'string' ? query.chatId : ''
  console.log('[vishing-api] request', { chatId, conversationId, userId })
  if (!chatId) {
    throw createError({ statusCode: 400, statusMessage: 'chatId is required' })
  }

  const escapedConversationId = escapeLikePattern(conversationId)
  const likePattern = `%${escapedConversationId}%`

  const db = useDrizzle()
  const ownedChat = await db.query.chats.findFirst({
    where: (chat, { and, eq }) => and(eq(chat.id, chatId), eq(chat.userId, userId)),
    columns: { id: true }
  })

  if (!ownedChat) {
    console.warn('[vishing-api] chat ownership check failed', { chatId, conversationId, userId })
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }
  console.log('[vishing-api] chat ownership verified', { chatId, conversationId, userId })

  const conversationHint = await db
    .select({ messageId: tables.messages.id })
    .from(tables.messages)
    .innerJoin(tables.chats, eq(tables.messages.chatId, tables.chats.id))
    .where(
      and(
        eq(tables.chats.id, chatId),
        eq(tables.chats.userId, userId),
        eq(tables.messages.role, 'assistant'),
        sql`${tables.messages.content} LIKE ${likePattern} ESCAPE '\\'`
      )
    )
    .get()

  // Conversation signal can arrive before the assistant message is persisted.
  // We treat this as a soft hint only, while hard authorization stays on chat ownership.
  if (!conversationHint) {
    console.warn('[vishing-api] conversation not yet found in persisted assistant messages', {
      chatId,
      conversationId
    })
  } else {
    console.log('[vishing-api] conversation hint found in assistant messages', {
      chatId,
      conversationId
    })
  }

  const config = useRuntimeConfig()
  const elevenlabsApiKey = config.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || ''
  if (!elevenlabsApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'ELEVENLABS_API_KEY is not configured' })
  }

  const endpoint = `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`
  console.log('[vishing-api] calling elevenlabs', {
    chatId,
    conversationId,
    timeoutMs: ELEVENLABS_TIMEOUT_MS
  })
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), ELEVENLABS_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'xi-api-key': elevenlabsApiKey
      },
      signal: abortController.signal
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw createError({
        statusCode: 504,
        statusMessage: 'ElevenLabs request timed out'
      })
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    console.warn('[vishing-api] elevenlabs non-200 response', {
      chatId,
      conversationId,
      status: response.status,
      statusText: response.statusText
    })
    throw createError({
      statusCode: response.status,
      statusMessage: `ElevenLabs error: ${response.statusText}`
    })
  }

  const data = await response.json() as ElevenLabsConversationResponse
  const hasAudio = data.hasAudio
    ?? data.has_audio
    ?? data.metadata?.hasAudio
    ?? data.metadata?.has_audio
    ?? false

  const recordingUrl = data.recordingUrl
    || data.recording_url
    || data.audioUrl
    || data.audio_url
    || data.metadata?.recordingUrl
    || data.metadata?.recording_url
    || data.metadata?.audioUrl
    || data.metadata?.audio_url
    || data.media?.recordingUrl
    || data.media?.recording_url
    || data.media?.audioUrl
    || data.media?.audio_url
    || ''

  const transcript = Array.isArray(data.transcript)
    ? data.transcript.map((item) => ({
      role: item.role === 'agent' ? 'agent' : 'user',
      message: item.message || '',
      timestamp: Number(item.time_in_call_secs || 0)
    }))
    : []

  console.log('[vishing-api] success', {
    chatId,
    conversationId,
    status: data.status || 'initiated',
    transcriptLength: transcript.length,
    callDurationSecs: Number(data.metadata?.call_duration_secs || 0),
    hasAudio: Boolean(hasAudio),
    hasRecordingUrl: Boolean(recordingUrl)
  })

  return {
    conversationId,
    status: data.status || 'initiated',
    callDurationSecs: Number(data.metadata?.call_duration_secs || 0),
    hasAudio: Boolean(hasAudio),
    recordingUrl: recordingUrl || undefined,
    transcript
  }
})
