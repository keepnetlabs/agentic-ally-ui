import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'

import * as schema from '../database/schema'

export { sql, eq, and, or } from 'drizzle-orm'

export const tables = schema

export function useDrizzle() {
  const event = useEvent()
  const d1 = event?.context.cloudflare?.env?.db

  if (!d1) {
    throw new Error('D1 binding "fleet-db" not found in Cloudflare env')
  }

  return drizzle(d1 as D1Database, { schema })
}

export type Chat = typeof schema.chats.$inferSelect
export type Message = typeof schema.messages.$inferSelect
