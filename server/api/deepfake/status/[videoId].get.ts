import { and, eq, sql } from 'drizzle-orm'
import { createError, getHeader, getQuery } from 'h3'
import * as tables from '../../../database/schema'
import { resolveChatUserId } from '../../../utils/iframe-auth'

const FLEET_TIMEOUT_MS = 30_000
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{4,256}$/

const escapeLikePattern = (input: string) =>
  input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

export default defineEventHandler(async (event) => {
  const userId = await resolveChatUserId(event)

  const { videoId } = getRouterParams(event)
  if (!videoId) {
    throw createError({ statusCode: 400, statusMessage: 'videoId is required' })
  }
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid videoId format' })
  }

  const query = getQuery(event)
  const chatId = typeof query.chatId === 'string' ? query.chatId : ''
  if (!chatId) {
    throw createError({ statusCode: 400, statusMessage: 'chatId is required' })
  }

  console.log('[deepfake-api] request', { chatId, videoId, userId })

  // Hard auth: verify chat ownership
  const db = useDrizzle()
  const ownedChat = await db.query.chats.findFirst({
    where: (chat, { and, eq }) => and(eq(chat.id, chatId), eq(chat.userId, userId)),
    columns: { id: true }
  })

  if (!ownedChat) {
    console.warn('[deepfake-api] chat ownership check failed', { chatId, videoId, userId })
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }
  console.log('[deepfake-api] chat ownership verified', { chatId, videoId })

  // Soft hint: check that videoId appears in a persisted message of this chat
  const escapedVideoId = escapeLikePattern(videoId)
  const likePattern = `%${escapedVideoId}%`
  const videoHint = await db
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

  if (!videoHint) {
    console.warn('[deepfake-api] videoId not yet found in persisted assistant messages', { chatId, videoId })
  } else {
    console.log('[deepfake-api] videoId hint found in assistant messages', { chatId, videoId })
  }

  const accessToken = getHeader(event, 'x-agentic-ally-token')
    || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
    || ''

  const fleetUrl = process.env.FLEET_AGENT_URL || 'http://localhost:4111'
  // Extract origin only — FLEET_AGENT_URL may include a path like /chat (used by the chat endpoint),
  // but deepfake/status lives at the root level of the fleet agent.
  const agentBase = (() => {
    try { return new URL(fleetUrl).origin } catch { return fleetUrl.replace(/\/[^/]+\/?$/, '') }
  })()

  const endpoint = `${agentBase}/deepfake/status/${encodeURIComponent(videoId)}`
  console.log('[deepfake-api] calling fleet agent', { chatId, videoId, timeoutMs: FLEET_TIMEOUT_MS })

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), FLEET_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        ...(accessToken ? { 'X-AGENTIC-ALLY-TOKEN': accessToken } : {}),
        'Accept': 'application/json'
      },
      signal: abortController.signal
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw createError({ statusCode: 504, statusMessage: 'Deepfake status request timed out' })
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    console.warn('[deepfake-api] non-200 response', {
      chatId,
      videoId,
      status: response.status,
      statusText: response.statusText
    })
    throw createError({
      statusCode: response.status,
      statusMessage: `Deepfake status error: ${response.statusText}`
    })
  }

  const data = await response.json() as {
    success: boolean
    videoId: string
    status: string
    videoUrl: string | null
    thumbnailUrl: string | null
    durationSec: number | null
    error?: string
  }

  console.log('[deepfake-api] success', {
    chatId,
    videoId,
    status: data.status,
    hasVideoUrl: Boolean(data.videoUrl)
  })

  return {
    success:      data.success ?? true,
    videoId:      data.videoId || videoId,
    status:       data.status || 'processing',
    videoUrl:     data.videoUrl ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
    durationSec:  data.durationSec ?? null
  }
})
