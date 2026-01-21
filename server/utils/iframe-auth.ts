import { createError, getHeader, getQuery, H3Event } from 'h3'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isString = (value: unknown): value is string => typeof value === 'string'

const base64UrlToString = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf-8')
  }

  if (typeof atob === 'function') {
    return atob(padded)
  }

  throw createError({ statusCode: 500, statusMessage: 'Base64 decoder unavailable' })
}

const getAccessToken = (event: H3Event): string | undefined => {
  const headerToken = getHeader(event, 'x-agentic-ally-token')
  if (headerToken) {
    return headerToken
  }

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    return undefined
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined
  }

  return token
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.')
  if (parts.length < 2) {
    return null
  }

  try {
    const payloadJson = base64UrlToString(parts[1])
    const parsed = JSON.parse(payloadJson)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const extractCompanyId = (payload: Record<string, unknown>): string | undefined => {
  const companyId = payload.user_company_resourceid ?? payload.companyId ?? payload.company_id
  return isString(companyId) ? companyId : undefined
}

const extractUserId = (payload: Record<string, unknown>): string | undefined => {
  const userId = payload.user_id ?? payload.sub ?? payload.uid
  if (typeof userId === 'number') {
    return String(userId)
  }
  return isString(userId) ? userId : undefined
}

const extractEmail = (payload: Record<string, unknown>): string | undefined => {
  const email = payload.user_email ?? payload.email ?? payload.upn ?? payload.preferred_username
  return isString(email) ? email : undefined
}

const normalizeSessionId = (sessionId: string) => sessionId.toLowerCase()

const normalizeEmail = (value: string) => value.toLowerCase().replace(/@/g, '_')

const parseSessionId = (sessionId: string) => {
  const parts = sessionId.split('-')
  if (parts.length < 3) {
    return null
  }

  const sessionUserId = parts[0]
  const sessionCompanyId = parts[parts.length - 1]
  const sessionEmail = parts.slice(1, -1).join('-')

  return {
    sessionUserId,
    sessionCompanyId,
    sessionEmail: sessionEmail.toLowerCase()
  }
}

const isSessionIdMatched = (
  sessionId: string,
  companyId?: string,
  userId?: string,
  email?: string
): boolean => {
  const parsed = parseSessionId(sessionId)
  if (!parsed || !companyId) {
    return false
  }

  if (parsed.sessionCompanyId !== companyId) {
    return false
  }

  const normalizedEmail = email ? normalizeEmail(email) : undefined
  const userMatch = userId ? parsed.sessionUserId === userId : undefined
  const emailMatch = normalizedEmail ? parsed.sessionEmail.includes(normalizedEmail) : undefined

  const checks = [userMatch, emailMatch].filter((value): value is boolean => value !== undefined)
  if (checks.length === 0) {
    return false
  }

  return checks.some(Boolean)
}

export const resolveChatUserId = async (event: H3Event): Promise<string> => {
  const query = getQuery(event)
  const querySessionId = typeof query.sessionId === 'string' ? query.sessionId : undefined

  if (!querySessionId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const accessToken = getAccessToken(event)
  if (!accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const payload = decodeJwtPayload(accessToken)
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const companyId = extractCompanyId(payload)
  const userId = extractUserId(payload)
  const email = extractEmail(payload)

  if (!isSessionIdMatched(querySessionId, companyId, userId, email)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return querySessionId
}
