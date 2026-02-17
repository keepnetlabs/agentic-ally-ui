import { createError, getQuery } from 'h3'

const AUDIO_FETCH_TIMEOUT_MS = 30000
const CONVERSATION_ID_PATTERN = /^conv_[A-Za-z0-9_-]{6,128}$/

function isAllowedAudioHost(hostname: string) {
  const normalized = hostname.toLowerCase()
  return normalized === 'elevenlabs.io'
    || normalized.endsWith('.elevenlabs.io')
    || normalized.includes('elevenlabs')
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const conversationId = typeof query.conversationId === 'string' ? query.conversationId : ''
  const rawUrl = typeof query.url === 'string' ? query.url : ''

  let upstreamUrl = ''
  if (conversationId) {
    if (!CONVERSATION_ID_PATTERN.test(conversationId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid conversationId format' })
    }
    upstreamUrl = `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`
  } else if (rawUrl) {
    let audioUrl: URL
    try {
      audioUrl = new URL(rawUrl)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid url' })
    }

    if (audioUrl.protocol !== 'https:') {
      throw createError({ statusCode: 400, statusMessage: 'Only https audio urls are allowed' })
    }

    if (!isAllowedAudioHost(audioUrl.hostname)) {
      throw createError({ statusCode: 400, statusMessage: 'Audio host is not allowed' })
    }

    upstreamUrl = audioUrl.toString()
  } else {
    throw createError({ statusCode: 400, statusMessage: 'conversationId or url is required' })
  }

  const config = useRuntimeConfig()
  const elevenlabsApiKey = config.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || ''

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), AUDIO_FETCH_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        ...(elevenlabsApiKey ? { 'xi-api-key': elevenlabsApiKey } : {})
      },
      signal: abortController.signal
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw createError({ statusCode: 504, statusMessage: 'Audio request timed out' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch audio stream' })
  } finally {
    clearTimeout(timeout)
  }

  if (!upstream.ok || !upstream.body) {
    throw createError({
      statusCode: upstream.status || 502,
      statusMessage: `Audio upstream error: ${upstream.statusText || 'Unknown'}`
    })
  }

  const headers = new Headers()
  headers.set('content-type', upstream.headers.get('content-type') || 'audio/mpeg')
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('content-length', contentLength)
  headers.set('cache-control', 'private, max-age=300')

  return new Response(upstream.body, {
    status: 200,
    headers
  })
})
