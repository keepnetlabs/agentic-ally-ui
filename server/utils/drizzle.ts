import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'

import * as schema from '../database/schema'

export { sql, eq, and, or } from 'drizzle-orm'

export const tables = schema

export function useDrizzle() {
  const event = useEvent()

  // Try multiple paths for D1 binding (compatibility with hub blob)
  let d1 = event?.context?.cloudflare?.env?.db

  // If not found, try alternative paths
  if (!d1) {
    d1 = event?.context?.env?.db
  }
  if (!d1 && (event as any)?.context?.cloudflare) {
    // Try direct access
    const cfContext = (event as any).context.cloudflare
    d1 = cfContext.env?.db || cfContext.db || cfContext.DB
  }

  // Last resort: try to get from runtime
  if (!d1 && typeof globalThis !== 'undefined') {
    const runtime = (globalThis as any).__env__ || (globalThis as any).__CF_WORKER__
    if (runtime?.db) {
      d1 = runtime.db
    }
  }

  if (!d1) {
    // Debug: log available context
    const contextKeys = event?.context ? Object.keys(event.context) : []
    const cloudflareKeys = event?.context?.cloudflare ? Object.keys(event.context.cloudflare) : []
    console.error('D1 binding not found. Context keys:', contextKeys)
    console.error('Cloudflare keys:', cloudflareKeys)
    throw new Error('D1 binding "db" not found in Cloudflare env')
  }

  return drizzle(d1 as D1Database, { schema })
}

export type Chat = typeof schema.chats.$inferSelect
export type Message = typeof schema.messages.$inferSelect
