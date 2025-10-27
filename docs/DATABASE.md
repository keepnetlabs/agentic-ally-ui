# Database Guide

## Overview

The project uses **Cloudflare D1** (SQLite-based) with **Drizzle ORM** for type-safe database operations.

Database is hosted on Cloudflare and stored locally for development in `.wrangler/state/d1/`.

## Schema

### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  username TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerId INTEGER NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
  UNIQUE (provider, providerId)
)
```

**Fields:**
- `id`: UUID from nuxt-auth-utils
- `email`: User's email (from GitHub)
- `name`: User's full name (from GitHub)
- `avatar`: User's avatar URL
- `username`: GitHub login (e.g., "john-doe")
- `provider`: Always "github"
- `providerId`: GitHub user ID (numeric)
- `createdAt`: Unix timestamp (auto)

**Example:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": "https://avatars.githubusercontent.com/...",
  "username": "john-doe",
  "provider": "github",
  "providerId": 12345678,
  "createdAt": 1698765432
}
```

---

### Chats Table

```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  title TEXT,
  userId TEXT NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX userIdIdx ON (userId)
)
```

**Fields:**
- `id`: UUID (generated on chat creation)
- `title`: First 100 chars of user's prompt (auto-generated)
- `userId`: FK to users (or 'guest-session' for anonymous)
- `createdAt`: Unix timestamp (auto)

**Example:**
```json
{
  "id": "chat-550e8400-e29b-41d4-a716-446655440000",
  "title": "Create Phishing Awareness Training",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": 1698765432
}
```

---

### Messages Table

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
  INDEX chatIdIdx ON (chatId)
)
```

**Fields:**
- `id`: UUID (generated when message created)
- `chatId`: FK to chats (cascade delete)
- `role`: "user" or "assistant"
- `content`: Full message text (markdown for AI responses)
- `createdAt`: Unix timestamp (auto)

**Example:**
```json
{
  "id": "msg-550e8400-e29b-41d4-a716-446655440000",
  "chatId": "chat-550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "content": "Create Phishing Awareness Training",
  "createdAt": 1698765432
}
```

---

## Relationships

```
users (1) ──┐
            ├──→ chats (1) ──┐
            │                ├──→ messages
            └────────────────┘
```

- **User → Chats**: One user has many chats (1-to-N)
- **Chat → Messages**: One chat has many messages (1-to-N)
- **Cascade Delete**: Deleting a chat deletes all its messages

---

## Drizzle ORM Usage

### Schema Definition

Location: `server/database/schema.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  // ...
})

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  // ...
})

export const usersRelations = relations(users, ({ many }) => ({
  chats: many(chats)
}))

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users),
  messages: many(messages)
}))
```

### Querying Data

#### Find Single Record
```typescript
const user = await db.query.users.findFirst({
  where: (user, { eq }) => eq(user.id, userId)
})

// With relations
const chat = await db.query.chats.findFirst({
  where: (chat, { eq }) => eq(chat.id, chatId),
  with: {
    messages: true
  }
})
```

#### Find Multiple Records
```typescript
const chats = await db.query.chats.findMany({
  where: (chat, { eq }) => eq(chat.userId, userId),
  orderBy: (chat) => desc(chat.createdAt)
})

// With filtering
const messages = await db.query.messages.findMany({
  where: (msg, { eq, and, gt }) => and(
    eq(msg.chatId, chatId),
    gt(msg.createdAt, thresholdTime)
  )
})
```

#### Create Record
```typescript
const newChat = await db.insert(chats).values({
  id: randomUUID(),
  userId: session.user.id,
  title: prompt.substring(0, 100),
  createdAt: Date.now()
}).returning()

return newChat[0]
```

#### Update Record
```typescript
const updated = await db.update(chats)
  .set({ title: newTitle })
  .where(eq(chats.id, chatId))
  .returning()
```

#### Delete Record
```typescript
// Single delete
await db.delete(messages)
  .where(eq(messages.id, messageId))

// Cascade delete (chat deletes messages automatically)
await db.delete(chats)
  .where(eq(chats.id, chatId))
```

---

## Common Patterns

### Get User with All Chats
```typescript
const userWithChats = await db.query.users.findFirst({
  where: (user, { eq }) => eq(user.id, userId),
  with: {
    chats: {
      orderBy: (chat) => desc(chat.createdAt)
    }
  }
})
```

### Get Chat with All Messages
```typescript
const chatWithMessages = await db.query.chats.findFirst({
  where: (chat, { eq }) => eq(chat.id, chatId),
  with: {
    messages: {
      orderBy: (msg) => asc(msg.createdAt)
    }
  }
})
```

### Check Ownership
```typescript
const chat = await db.query.chats.findFirst({
  where: (chat, { eq, and }) => and(
    eq(chat.id, chatId),
    eq(chat.userId, userId)  // Ensure user owns it
  )
})

if (!chat) {
  throw createError({ statusCode: 404 })
}
```

### Pagination (When Needed)
```typescript
const PAGE_SIZE = 20
const page = 1

const chats = await db.query.chats.findMany({
  where: (chat, { eq }) => eq(chat.userId, userId),
  orderBy: (chat) => desc(chat.createdAt),
  limit: PAGE_SIZE,
  offset: (page - 1) * PAGE_SIZE
})
```

---

## Timestamps

All timestamps use **Unix epoch** (seconds since 1970-01-01).

### Setting Timestamps
```typescript
// Automatic (schema default)
createdAt: integer('createdAt').default(sql`unixepoch()`)

// Manual
createdAt: Math.floor(Date.now() / 1000)  // Convert ms to seconds
```

### Comparing Timestamps
```typescript
// Last 24 hours
const threshold = Math.floor((Date.now() - 86400000) / 1000)  // 24h in ms

const recent = await db.query.messages.findMany({
  where: (msg, { gt }) => gt(msg.createdAt, threshold)
})
```

### Formatting Timestamps
```typescript
import { formatDistanceToNow } from 'date-fns'

const timestamp = 1698765432  // Unix epoch
const readable = formatDistanceToNow(timestamp * 1000)  // Convert to ms
// Result: "2 hours ago"
```

---

## Migrations

### Creating a Migration

1. Modify schema in `server/database/schema.ts`
2. Create migration file: `server/database/migrations/[number]_description.sql`

Example:
```sql
-- server/database/migrations/0001_add_tags.sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX tagsChatIdIdx ON tags(chatId);
```

3. Test locally:
```bash
yarn cf:reset
```

4. Apply to production:
```bash
wrangler d1 migrations apply agentic-ally-db
```

### Viewing Migrations

```bash
# List all migrations
npx wrangler d1 migrations list agentic-ally-db --local

# View current schema
npx wrangler d1 execute agentic-ally-db --local --command ".schema"
```

---

## Local Development

### Reset Database
```bash
yarn cf:reset
```

Removes `.wrangler/state/d1/` and re-applies all migrations.

### Query Local Database
```bash
# List all chats
npx wrangler d1 execute agentic-ally-db --local \
  --command "SELECT id, title, createdAt FROM chats ORDER BY createdAt DESC"

# Count messages
npx wrangler d1 execute agentic-ally-db --local \
  --command "SELECT COUNT(*) as count FROM messages"

# Find user
npx wrangler d1 execute agentic-ally-db --local \
  --command "SELECT * FROM users WHERE username = 'john-doe'"
```

### Inspect Data File
D1 database is stored at: `.wrangler/state/d1/db.sqlite`

You can open with:
- DB Browser for SQLite (GUI)
- SQLite CLI: `sqlite3 .wrangler/state/d1/db.sqlite`

---

## Production

### Viewing Production Database

Via Cloudflare Dashboard:
1. Go to Workers → D1 Databases
2. Select `agentic-ally-db`
3. Browse data or run queries

### Backups

Cloudflare D1 automatically backs up:
- Daily snapshots
- Point-in-time recovery available

---

## Best Practices

1. **Always verify ownership** before modifying data
   ```typescript
   const item = await db.query.items.findFirst({
     where: (item, { eq, and }) => and(
       eq(item.id, itemId),
       eq(item.userId, userId)
     )
   })
   ```

2. **Use transactions for multi-step operations**
   ```typescript
   await db.transaction(async (tx) => {
     // All operations here are atomic
   })
   ```

3. **Use indexes for frequently queried columns**
   ```sql
   CREATE INDEX userIdIdx ON chats(userId);
   ```

4. **Validate input before inserting**
   ```typescript
   if (!userId || !content) {
     throw createError({ statusCode: 400 })
   }
   ```

5. **Use relations to avoid N+1 queries**
   ```typescript
   // ✅ Good - one query with relations
   const user = await db.query.users.findFirst({
     with: { chats: true }
   })

   // ❌ Bad - N+1 queries
   const user = await db.query.users.findFirst()
   const chats = await db.query.chats.findMany()
   ```

---

## Troubleshooting

### "no such table: chats"
```bash
yarn cf:reset
```

### Database locked
1. Kill dev server
2. Delete `.wrangler/state/d1/`
3. Run `yarn cf:reset`
4. Restart server

### Type errors after schema change
```bash
yarn cf:typegen
```

### Migration won't apply
- Check migration syntax
- Reset and try again: `yarn cf:reset`

See [SETUP.md](SETUP.md) for more troubleshooting.
